import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { customType } from 'drizzle-orm/pg-core';

/**
 * Encriptação simétrica autenticada (AES-256-GCM) para segredos guardados
 * at-rest, como o `two_factor_secret`. GCM dá-nos confidencialidade + um tag
 * de autenticação, por isso ciphertext adulterado é rejeitado no decrypt.
 *
 * A chave ativa vem de APP_ENCRYPTION_KEY (base64 de 32 bytes), versionada por
 * APP_ENCRYPTION_KEY_VERSION, e nunca é guardada na base de dados. Formato do
 * payload: `v{versao}.<iv>.<tag>.<ciphertext>` (cada parte em base64).
 *
 * Rotação de chave:
 *   1. Gerar uma nova chave: openssl rand -base64 32
 *   2. Definir essa chave em APP_ENCRYPTION_KEY e subir APP_ENCRYPTION_KEY_VERSION
 *      (ex.: de 1 para 2).
 *   3. Mover a chave anterior para APP_ENCRYPTION_KEYS_RETIRED (formato
 *      "1:<base64>,2:<base64>") para que os dados antigos continuem a
 *      desencriptar — a chave retirada já não é usada para encriptar.
 *   4. Um job na camada de serviço relê e regrava as linhas antigas com a
 *      chave ativa (re-encriptação em lote).
 *   5. Depois de todas as linhas migradas, remover a chave retirada de
 *      APP_ENCRYPTION_KEYS_RETIRED.
 */

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // recomendado para GCM
const TAG_LENGTH = 16;
const KEY_BYTES = 32; // AES-256
const KEY_ENV = 'APP_ENCRYPTION_KEY';
const VERSION_ENV = 'APP_ENCRYPTION_KEY_VERSION';
const RETIRED_ENV = 'APP_ENCRYPTION_KEYS_RETIRED';

function decodeKey(envVar: string, raw: string): Buffer {
  const key = Buffer.from(raw, 'base64');
  if (key.length !== KEY_BYTES) {
    throw new Error(
      `${envVar} tem de descodificar para ${KEY_BYTES} bytes (recebeu ${key.length}). ` +
        'Gera uma com: openssl rand -base64 32',
    );
  }
  return key;
}

interface KeyRing {
  activeVersion: number;
  keys: Map<number, Buffer>;
}

let cachedRing: KeyRing | null = null;

function loadKeyRing(): KeyRing {
  if (cachedRing) return cachedRing;

  const raw = process.env[KEY_ENV];
  if (!raw) {
    throw new Error(`${KEY_ENV} é obrigatória para encriptar/desencriptar segredos.`);
  }
  const activeKey = decodeKey(KEY_ENV, raw);

  const versionRaw = process.env[VERSION_ENV];
  let activeVersion = 1;
  if (versionRaw !== undefined && versionRaw !== '') {
    activeVersion = Number(versionRaw);
    if (!Number.isInteger(activeVersion) || activeVersion < 1) {
      throw new Error(`${VERSION_ENV} tem de ser um inteiro >= 1 (recebeu "${versionRaw}").`);
    }
  }

  const keys = new Map<number, Buffer>([[activeVersion, activeKey]]);

  const retiredRaw = process.env[RETIRED_ENV];
  if (retiredRaw) {
    for (const entry of retiredRaw.split(',').map((e) => e.trim()).filter(Boolean)) {
      const separatorIndex = entry.indexOf(':');
      if (separatorIndex === -1) {
        throw new Error(`${RETIRED_ENV} malformada, esperado "versao:chave" (recebeu "${entry}").`);
      }
      const versionStr = entry.slice(0, separatorIndex);
      const keyB64 = entry.slice(separatorIndex + 1);
      const version = Number(versionStr);
      if (!Number.isInteger(version) || version < 1) {
        throw new Error(`${RETIRED_ENV} tem uma versão inválida ("${versionStr}").`);
      }
      if (version === activeVersion) {
        throw new Error(
          `${RETIRED_ENV} não pode reutilizar a versão ativa (${activeVersion}).`,
        );
      }
      keys.set(version, decodeKey(RETIRED_ENV, keyB64));
    }
  }

  cachedRing = { activeVersion, keys };
  return cachedRing;
}

export function encryptSecret(plaintext: string): string {
  const { activeVersion, keys } = loadKeyRing();
  const key = keys.get(activeVersion);
  if (!key) {
    throw new Error(`Chave ativa (versão ${activeVersion}) não encontrada no key ring.`);
  }
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    `v${activeVersion}`,
    iv.toString('base64'),
    tag.toString('base64'),
    encrypted.toString('base64'),
  ].join('.');
}

export function decryptSecret(payload: string): string {
  if (typeof payload !== 'string' || payload.length === 0) {
    throw new Error('Payload encriptado inválido.');
  }

  const parts = payload.split('.');
  if (parts.length !== 4) {
    throw new Error('Payload encriptado inválido.');
  }
  const [versionTag, ivB64, tagB64, dataB64] = parts;

  const versionMatch = /^v(\d+)$/.exec(versionTag);
  if (!versionMatch) {
    throw new Error('Payload encriptado inválido.');
  }
  const version = Number(versionMatch[1]);

  const { keys } = loadKeyRing();
  const key = keys.get(version);
  if (!key) {
    throw new Error(`Versão de chave desconhecida (v${version}).`);
  }

  let iv: Buffer;
  let tag: Buffer;
  let ciphertext: Buffer;
  try {
    iv = Buffer.from(ivB64, 'base64');
    tag = Buffer.from(tagB64, 'base64');
    ciphertext = Buffer.from(dataB64, 'base64');
  } catch {
    throw new Error('Payload encriptado malformado.');
  }
  if (iv.length !== IV_LENGTH || tag.length !== TAG_LENGTH || ciphertext.length < 1) {
    throw new Error('Payload encriptado malformado.');
  }

  try {
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return decrypted.toString('utf8');
  } catch {
    // Nunca distinguir "tag inválido" de "chave errada" — evita um oráculo
    // de erro para um atacante que tenta adulterar o ciphertext.
    throw new Error('Falha ao desencriptar segredo.');
  }
}

/**
 * Coluna `text` que encripta/desencripta de forma transparente. O valor em
 * memória é o segredo em claro; o que fica na base de dados é o ciphertext.
 * Nunca faças `select` desta coluna em contextos onde não precisas do segredo.
 */
export const encryptedText = customType<{ data: string; driverData: string }>({
  dataType() {
    return 'text';
  },
  toDriver(value) {
    return encryptSecret(value);
  },
  fromDriver(value) {
    return decryptSecret(value);
  },
});
