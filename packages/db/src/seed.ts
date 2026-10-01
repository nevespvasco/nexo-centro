import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import path from "node:path";
import * as bcrypt from "bcryptjs";
import { createDb } from "./client.js";
import {
  adminUsers,
  atividadesCientificas,
  cirurgias,
  diagnosticos,
  especialidadeHospital,
  especialidades,
  formacoes,
  funcaoCirurgiaoHospital,
  funcaoCirurgiaos,
  hospitalUser,
  hospitals,
  procedimentoHospital,
  procedimentos,
  registoCirurgicos,
  tipoDeAbordagemHospital,
  tipoDeAbordagens,
  tipoDeCirurgiaHospital,
  tipoDeCirurgias,
  users,
  utentes,
  zonaAnatomicaHospital,
  zonaAnatomicas,
} from "./schema/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, "../../../.env") });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error(
    'DATABASE_URL is required — see the "Base de dados (Drizzle)" section in README.md.',
  );
}
if (process.env.NODE_ENV === "production") {
  throw new Error("O seed de demonstração não pode ser executado em produção.");
}
const seedPassword = process.env.SEED_PASSWORD;
if (!seedPassword || seedPassword.length < 12) {
  throw new Error(
    "SEED_PASSWORD is required and must have at least 12 characters.",
  );
}

async function main() {
  const { db, pool } = createDb(databaseUrl!);
  const devPasswordHash = await bcrypt.hash(seedPassword!, 12);

  try {
    // Tudo numa transação: se qualquer insert falhar, faz rollback e a base de
    // dados fica limpa, para o seed poder voltar a correr sem meio-estado.
    await db.transaction(async (tx) => {
      const [hospitalCentral, hospitalNorte] = await tx
        .insert(hospitals)
        .values([
          { nome: "Hospital Central de Lisboa" },
          { nome: "Hospital do Norte" },
        ])
        .returning();

      await tx.insert(adminUsers).values([
        {
          nome: "Admin Nexo",
          email: "admin@nexo-centro.pt",
          password: devPasswordHash,
          hospitalId: null,
        },
        {
          nome: "Admin Hospital Central",
          email: "admin.central@nexo-centro.pt",
          password: devPasswordHash,
          hospitalId: hospitalCentral.id,
        },
      ]);

      // Especialidades: itens com id/conteúdo únicos, associados a hospitais.
      // "Cirurgia Geral" é global (visível em todos). Ortopedia e Urologia são
      // associadas ao respetivo hospital. createdByUserId fica null (itens sem
      // criador identificável, só editáveis por administrador) — os utilizadores
      // ainda não existem nesta fase do seed.
      const [espOrtopedia, espUrologia, espGlobalCirurgiaGeral] = await tx
        .insert(especialidades)
        .values([
          { nome: "Ortopedia" },
          { nome: "Urologia" },
          { nome: "Cirurgia Geral", isGlobal: true },
        ])
        .returning();

      await tx.insert(especialidadeHospital).values([
        { especialidadeId: espOrtopedia.id, hospitalId: hospitalCentral.id },
        { especialidadeId: espUrologia.id, hospitalId: hospitalNorte.id },
      ]);

      const [userJoao, userMaria, userRicardo] = await tx
        .insert(users)
        .values([
          {
            nome: "Dr. João Silva",
            email: "joao.silva@nexo-centro.pt",
            password: devPasswordHash,
            especialidadeId: espOrtopedia.id,
            emailVerifiedAt: new Date(),
          },
          {
            nome: "Dra. Maria Santos",
            email: "maria.santos@nexo-centro.pt",
            password: devPasswordHash,
            especialidadeId: espUrologia.id,
            emailVerifiedAt: new Date(),
          },
          {
            nome: "Dr. Ricardo Costa",
            email: "ricardo.costa@nexo-centro.pt",
            password: devPasswordHash,
            especialidadeId: espGlobalCirurgiaGeral.id,
            emailVerifiedAt: new Date(),
          },
        ])
        .returning();

      await tx.insert(hospitalUser).values([
        {
          hospitalId: hospitalCentral.id,
          userId: userJoao.id,
          status: "approved",
          canApproveMembers: true,
          approvedByUserId: userJoao.id,
          approvedAt: new Date(),
        },
        {
          hospitalId: hospitalNorte.id,
          userId: userMaria.id,
          status: "approved",
          approvedByUserId: userJoao.id,
          approvedAt: new Date(),
        },
        {
          hospitalId: hospitalCentral.id,
          userId: userRicardo.id,
          status: "pending",
        },
      ]);

      // Zonas anatómicas: itens partilháveis; a ordem por hospital vive na
      // associação. userJoao é o criador (pode gerir enquanto tiver acesso).
      const [zonaJoelho, zonaQuadril] = await tx
        .insert(zonaAnatomicas)
        .values([
          { nome: "Joelho", createdByUserId: userJoao.id },
          { nome: "Quadril", createdByUserId: userJoao.id },
        ])
        .returning();

      await tx.insert(zonaAnatomicaHospital).values([
        {
          zonaAnatomicaId: zonaJoelho.id,
          hospitalId: hospitalCentral.id,
          ordem: 1,
          createdByUserId: userJoao.id,
        },
        {
          zonaAnatomicaId: zonaQuadril.id,
          hospitalId: hospitalCentral.id,
          ordem: 2,
          createdByUserId: userJoao.id,
        },
      ]);

      const [diagLesaoMeniscal, diagOsteoartrose] = await tx
        .insert(diagnosticos)
        .values([
          {
            nome: "Lesão meniscal",
            zonaAnatomicaId: zonaJoelho.id,
            tipo: "benigno",
            hospitalId: hospitalCentral.id,
          },
          {
            nome: "Osteoartrose",
            zonaAnatomicaId: zonaQuadril.id,
            tipo: "benigno",
            hospitalId: hospitalCentral.id,
          },
        ])
        .returning();

      const [procArtroscopia, procArtroplastia] = await tx
        .insert(procedimentos)
        .values([
          {
            nome: "Artroscopia do joelho",
            especialidadeId: espOrtopedia.id,
            createdByUserId: userJoao.id,
          },
          {
            nome: "Artroplastia da anca",
            especialidadeId: espOrtopedia.id,
            createdByUserId: userJoao.id,
          },
        ])
        .returning();

      await tx.insert(procedimentoHospital).values([
        {
          procedimentoId: procArtroscopia.id,
          hospitalId: hospitalCentral.id,
          createdByUserId: userJoao.id,
        },
        {
          procedimentoId: procArtroplastia.id,
          hospitalId: hospitalCentral.id,
          createdByUserId: userJoao.id,
        },
      ]);

      const [tipoCirurgiaEletiva] = await tx
        .insert(tipoDeCirurgias)
        .values([{ nome: "Eletiva", createdByUserId: userJoao.id }])
        .returning();

      await tx.insert(tipoDeCirurgiaHospital).values([
        {
          tipoDeCirurgiaId: tipoCirurgiaEletiva.id,
          hospitalId: hospitalCentral.id,
          createdByUserId: userJoao.id,
        },
      ]);

      const [funcaoPrimeiroCirurgiao] = await tx
        .insert(funcaoCirurgiaos)
        .values([{ nome: "Primeiro cirurgião", createdByUserId: userJoao.id }])
        .returning();

      await tx.insert(funcaoCirurgiaoHospital).values([
        {
          funcaoCirurgiaoId: funcaoPrimeiroCirurgiao.id,
          hospitalId: hospitalCentral.id,
          createdByUserId: userJoao.id,
        },
      ]);

      const [abordagemArtroscopica] = await tx
        .insert(tipoDeAbordagens)
        .values([{ nome: "Artroscópica", createdByUserId: userJoao.id }])
        .returning();

      await tx.insert(tipoDeAbordagemHospital).values([
        {
          tipoDeAbordagemId: abordagemArtroscopica.id,
          hospitalId: hospitalCentral.id,
          createdByUserId: userJoao.id,
        },
      ]);

      const [utenteAna, utenteCarlos] = await tx
        .insert(utentes)
        .values([
          {
            nome: "Ana Ferreira",
            sexo: "feminino",
            processo: "100001",
            dataNascimento: "1992-03-14",
            hospitalId: hospitalCentral.id,
            createdByUserId: userJoao.id,
          },
          {
            nome: "Carlos Pinto",
            sexo: "masculino",
            processo: "100002",
            dataNascimento: "1965-07-22",
            hospitalId: hospitalCentral.id,
            createdByUserId: userJoao.id,
          },
        ])
        .returning();

      const [registoAna, registoCarlos] = await tx
        .insert(registoCirurgicos)
        .values([
          {
            hospitalId: hospitalCentral.id,
            userId: userJoao.id,
            utenteId: utenteAna.id,
            especialidadeId: espOrtopedia.id,
            dataCirurgia: "2026-02-10",
            idadeCirurgia: 34,
            tipoDeCirurgiaId: tipoCirurgiaEletiva.id,
            tipoDeAbordagemId: abordagemArtroscopica.id,
            ambulatorio: true,
            observacoes: "Recuperação sem intercorrências.",
          },
          {
            hospitalId: hospitalCentral.id,
            userId: userJoao.id,
            utenteId: utenteCarlos.id,
            especialidadeId: espOrtopedia.id,
            dataCirurgia: "2026-03-05",
            idadeCirurgia: 61,
            tipoDeCirurgiaId: tipoCirurgiaEletiva.id,
            ambulatorio: false,
          },
        ])
        .returning();

      await tx.insert(cirurgias).values([
        {
          registoCirurgicoId: registoAna.id,
          diagnosticoId: diagLesaoMeniscal.id,
          procedimentoId: procArtroscopia.id,
          tipo: "benigno",
          funcaoCirurgiaoId: funcaoPrimeiroCirurgiao.id,
          clavienDindo: "sem_complicacoes",
        },
        {
          registoCirurgicoId: registoCarlos.id,
          diagnosticoId: diagOsteoartrose.id,
          procedimentoId: procArtroplastia.id,
          tipo: "benigno",
          funcaoCirurgiaoId: funcaoPrimeiroCirurgiao.id,
          clavienDindo: "I",
          anatomiaPatologica: "Sem alterações significativas.",
        },
      ]);

      await tx.insert(atividadesCientificas).values([
        {
          userId: userJoao.id,
          titulo: "Resultados a longo prazo da artroscopia do joelho",
          tipo: "artigo",
          data: "2025-11-20",
          autorPrincipal: true,
          posicaoAutor: 1,
          fatorImpacto: "3.250",
        },
        {
          userId: userMaria.id,
          titulo: "Congresso Nacional de Urologia 2025",
          tipo: "congresso",
          data: "2025-09-15",
          autorPrincipal: false,
          posicaoAutor: 2,
        },
      ]);

      await tx.insert(formacoes).values([
        {
          userId: userJoao.id,
          titulo: "Curso avançado de artroscopia",
          tipo: "curso",
          dataInicio: "2025-05-01",
          dataFim: "2025-05-03",
          duracaoHoras: 24,
          creditos: "2.00",
        },
        {
          userId: userRicardo.id,
          titulo: "Pós-graduação em Cirurgia Minimamente Invasiva",
          tipo: "pos_graduacao",
          dataInicio: "2024-09-01",
          dataFim: "2025-07-15",
        },
      ]);
    });

    console.log("Seed concluído com sucesso.");
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Falha ao correr o seed:", err);
  process.exitCode = 1;
});
