const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // 1. Buat Data Divisi
  const divisions = [
    { name: 'Badan Pengurus Harian', code: 'BPH' },
    { name: 'Creative Marketing', code: 'CM' },
    { name: 'Business Development', code: 'BD' },
    { name: 'Business Education', code: 'BE' },
    { name: 'Networking Partnership', code: 'NP' },
    { name: 'Human Resource Development', code: 'HRD' },
    { name: 'Event Organizer', code: 'EO' },
  ];

  console.log('Sedang mengisi data divisi...');

  for (const div of divisions) {
    await prisma.division.upsert({
      where: { code: div.code },
      update: {},
      create: div,
    });
  }

  console.log('✅ Seeding selesai!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });