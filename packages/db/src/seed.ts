import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createDb } from './client.js';
import {
  adminUsers,
  atividadesCientificas,
  cirurgias,
  diagnosticos,
  especialidades,
  formacoes,
  funcaoCirurgiaos,
  hospitalUser,
  hospitals,
  modelHasPermissions,
  modelHasRoles,
  permissions,
  procedimentos,
  registoCirurgicos,
  roleHasPermissions,
  roles,
  tipoDeAbordagens,
  tipoDeCirurgias,
  users,
  utentes,
  zonaAnatomicas,
} from './schema/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, '../../../.env') });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL is required — see the "Base de dados (Drizzle)" section in README.md.');
}

const DEV_PASSWORD_HASH = '$2b$10$K3nWQpZ8h1yYQ8s2FQqXeOeYQmVQx1zQ8yq0G8bJb5x1yLzq0Zt9O';

async function main() {
  const { db, pool } = createDb(databaseUrl!);

  try {
    // Tudo numa transação: se qualquer insert falhar, faz rollback e a base de
    // dados fica limpa, para o seed poder voltar a correr sem meio-estado.
    await db.transaction(async (tx) => {
      await tx
        .insert(adminUsers)
        .values({ nome: 'Admin Nexo', email: 'admin@nexo-centro.pt', password: DEV_PASSWORD_HASH })
        .returning();

      const [hospitalCentral, hospitalNorte] = await tx
        .insert(hospitals)
        .values([{ nome: 'Hospital Central de Lisboa' }, { nome: 'Hospital do Norte' }])
        .returning();

      const [roleAdmin, roleCirurgiao] = await tx
        .insert(roles)
        .values([
          { nome: 'admin', guardName: 'web' },
          { nome: 'cirurgiao', guardName: 'web' },
        ])
        .returning();

      const [permManageUsers, permViewRegistos, permManageRegistos] = await tx
        .insert(permissions)
        .values([
          { nome: 'manage_users', guardName: 'web' },
          { nome: 'view_registos', guardName: 'web' },
          { nome: 'manage_registos', guardName: 'web' },
        ])
        .returning();

      await tx.insert(roleHasPermissions).values([
        { roleId: roleAdmin.id, permissionId: permManageUsers.id },
        { roleId: roleAdmin.id, permissionId: permViewRegistos.id },
        { roleId: roleAdmin.id, permissionId: permManageRegistos.id },
        { roleId: roleCirurgiao.id, permissionId: permViewRegistos.id },
        { roleId: roleCirurgiao.id, permissionId: permManageRegistos.id },
      ]);

      const [espOrtopedia, espUrologia, espGlobalCirurgiaGeral] = await tx
        .insert(especialidades)
        .values([
          { nome: 'Ortopedia', hospitalId: hospitalCentral.id },
          { nome: 'Urologia', hospitalId: hospitalNorte.id },
          { nome: 'Cirurgia Geral', isSystem: true },
        ])
        .returning();

      const [userJoao, userMaria, userRicardo] = await tx
        .insert(users)
        .values([
          {
            nome: 'Dr. João Silva',
            email: 'joao.silva@nexo-centro.pt',
            password: DEV_PASSWORD_HASH,
            especialidadeId: espOrtopedia.id,
            emailVerifiedAt: new Date(),
          },
          {
            nome: 'Dra. Maria Santos',
            email: 'maria.santos@nexo-centro.pt',
            password: DEV_PASSWORD_HASH,
            especialidadeId: espUrologia.id,
            emailVerifiedAt: new Date(),
          },
          {
            nome: 'Dr. Ricardo Costa',
            email: 'ricardo.costa@nexo-centro.pt',
            password: DEV_PASSWORD_HASH,
            especialidadeId: espGlobalCirurgiaGeral.id,
            emailVerifiedAt: new Date(),
          },
        ])
        .returning();

      await tx.insert(hospitalUser).values([
        {
          hospitalId: hospitalCentral.id,
          userId: userJoao.id,
          status: 'approved',
          papel: 'admin',
          approvedByUserId: userJoao.id,
          approvedAt: new Date(),
        },
        {
          hospitalId: hospitalNorte.id,
          userId: userMaria.id,
          status: 'approved',
          papel: 'membro',
          approvedByUserId: userJoao.id,
          approvedAt: new Date(),
        },
        {
          hospitalId: hospitalCentral.id,
          userId: userRicardo.id,
          status: 'pending',
          papel: 'membro',
        },
      ]);

      await tx.insert(modelHasRoles).values([
        { roleId: roleAdmin.id, modelType: 'user', modelId: userJoao.id },
        { roleId: roleCirurgiao.id, modelType: 'user', modelId: userMaria.id },
        { roleId: roleCirurgiao.id, modelType: 'user', modelId: userRicardo.id },
      ]);

      await tx.insert(modelHasPermissions).values([
        { permissionId: permManageUsers.id, modelType: 'user', modelId: userJoao.id },
        { permissionId: permViewRegistos.id, modelType: 'user', modelId: userRicardo.id },
      ]);

      const [zonaJoelho, zonaQuadril] = await tx
        .insert(zonaAnatomicas)
        .values([
          { nome: 'Joelho', hospitalId: hospitalCentral.id, ordem: 1 },
          { nome: 'Quadril', hospitalId: hospitalCentral.id, ordem: 2 },
        ])
        .returning();

      const [diagLesaoMeniscal, diagOsteoartrose] = await tx
        .insert(diagnosticos)
        .values([
          {
            nome: 'Lesão meniscal',
            zonaAnatomicaId: zonaJoelho.id,
            tipo: 'benigno',
            hospitalId: hospitalCentral.id,
          },
          {
            nome: 'Osteoartrose',
            zonaAnatomicaId: zonaQuadril.id,
            tipo: 'benigno',
            hospitalId: hospitalCentral.id,
          },
        ])
        .returning();

      const [procArtroscopia, procArtroplastia] = await tx
        .insert(procedimentos)
        .values([
          { nome: 'Artroscopia do joelho', especialidadeId: espOrtopedia.id, hospitalId: hospitalCentral.id },
          { nome: 'Artroplastia da anca', especialidadeId: espOrtopedia.id, hospitalId: hospitalCentral.id },
        ])
        .returning();

      const [tipoCirurgiaEletiva] = await tx
        .insert(tipoDeCirurgias)
        .values([{ nome: 'Eletiva', hospitalId: hospitalCentral.id }])
        .returning();

      const [funcaoPrimeiroCirurgiao] = await tx
        .insert(funcaoCirurgiaos)
        .values([{ nome: 'Primeiro cirurgião', hospitalId: hospitalCentral.id }])
        .returning();

      const [abordagemArtroscopica] = await tx
        .insert(tipoDeAbordagens)
        .values([{ nome: 'Artroscópica', hospitalId: hospitalCentral.id }])
        .returning();

      const [utenteAna, utenteCarlos] = await tx
        .insert(utentes)
        .values([
          { nome: 'Ana Ferreira', sexo: 'feminino', processo: '100001', hospitalId: hospitalCentral.id, createdByUserId: userJoao.id },
          { nome: 'Carlos Pinto', sexo: 'masculino', processo: '100002', hospitalId: hospitalCentral.id, createdByUserId: userJoao.id },
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
            dataCirurgia: '2026-02-10',
            idadeCirurgia: 34,
            tipoDeCirurgiaId: tipoCirurgiaEletiva.id,
            tipoDeAbordagemId: abordagemArtroscopica.id,
            ambulatorio: true,
            observacoes: 'Recuperação sem intercorrências.',
          },
          {
            hospitalId: hospitalCentral.id,
            userId: userJoao.id,
            utenteId: utenteCarlos.id,
            especialidadeId: espOrtopedia.id,
            dataCirurgia: '2026-03-05',
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
          tipo: 'benigno',
          funcaoCirurgiaoId: funcaoPrimeiroCirurgiao.id,
          clavienDindo: 'sem_complicacoes',
        },
        {
          registoCirurgicoId: registoCarlos.id,
          diagnosticoId: diagOsteoartrose.id,
          procedimentoId: procArtroplastia.id,
          tipo: 'benigno',
          funcaoCirurgiaoId: funcaoPrimeiroCirurgiao.id,
          clavienDindo: 'I',
          anatomiaPatologica: 'Sem alterações significativas.',
        },
      ]);

      await tx.insert(atividadesCientificas).values([
        {
          userId: userJoao.id,
          titulo: 'Resultados a longo prazo da artroscopia do joelho',
          tipo: 'artigo',
          data: '2025-11-20',
          autorPrincipal: true,
          posicaoAutor: 1,
          fatorImpacto: '3.250',
        },
        {
          userId: userMaria.id,
          titulo: 'Congresso Nacional de Urologia 2025',
          tipo: 'congresso',
          data: '2025-09-15',
          autorPrincipal: false,
          posicaoAutor: 2,
        },
      ]);

      await tx.insert(formacoes).values([
        {
          userId: userJoao.id,
          titulo: 'Curso avançado de artroscopia',
          tipo: 'curso',
          dataInicio: '2025-05-01',
          dataFim: '2025-05-03',
          duracaoHoras: 24,
          creditos: '2.00',
        },
        {
          userId: userRicardo.id,
          titulo: 'Pós-graduação em Cirurgia Minimamente Invasiva',
          tipo: 'pos_graduacao',
          dataInicio: '2024-09-01',
          dataFim: '2025-07-15',
        },
      ]);
    });

    console.log('Seed concluído com sucesso.');
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Falha ao correr o seed:', err);
  process.exitCode = 1;
});
