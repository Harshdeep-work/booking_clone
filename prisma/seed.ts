import { PrismaClient, SeatStatus } from '@prisma/client';
import { generateStadiumSections, CENTER_LNG, CENTER_LAT } from '../src/data/stadiumGeometry';

const prisma = new PrismaClient();

const SEAT_STATUSES: SeatStatus[] = ['AVAILABLE', 'AVAILABLE', 'AVAILABLE', 'SOLD', 'AVAILABLE'];

async function main() {
  console.log('🌱 Starting database seed...');

  // Clean existing data
  await prisma.order.deleteMany();
  await prisma.seat.deleteMany();
  await prisma.pricingRule.deleteMany();
  await prisma.section.deleteMany();
  await prisma.layout.deleteMany();
  await prisma.event.deleteMany();
  console.log('🧹 Cleared existing data');

  // Create event
  const event = await prisma.event.create({
    data: {
      name: '2026 FIFA World Cup — Group Stage',
      date: new Date('2026-06-13T19:00:00Z'),
      venue: 'MetLife Stadium',
      city: 'East Rutherford, NJ',
      imageUrl: 'https://images.unsplash.com/photo-1516912481808-3406841bd33c',
    },
  });
  console.log(`✅ Created event: ${event.name}`);

  // Create layout
  const layout = await prisma.layout.create({
    data: {
      eventId: event.id,
      name: 'MetLife Stadium v1',
      version: 1,
      isActive: true,
    },
  });
  console.log(`✅ Created layout: ${layout.name}`);

  // Generate and insert sections
  const stadiumSections = generateStadiumSections();
  console.log(`📐 Generating ${stadiumSections.length} sections...`);

  let totalSeats = 0;

  for (const secDef of stadiumSections) {
    // Create section
    const section = await prisma.section.create({
      data: {
        layoutId: layout.id,
        section_id: secDef.section_id,
        label: secDef.label,
        category: secDef.category,
        color: secDef.color,
        geometry: secDef.geometry as object,
        centerX: secDef.centerLng,
        centerY: secDef.centerLat,
      },
    });

    // Create pricing rule
    const basePrice = secDef.basePrice;
    await prisma.pricingRule.create({
      data: {
        sectionId: section.id,
        base_price: basePrice,
        demand_multiplier: secDef.category === 'FIELD' ? 2.5 : secDef.category === 'PLATINUM' ? 2.0 : 1.5,
        time_factor: 1.2,
        min_price: Math.round(basePrice * 0.7),
        max_price: Math.round(basePrice * 3.0),
      },
    });

    // Create seats
    const seatsToCreate = [];
    for (let row = 1; row <= secDef.rows; row++) {
      for (let seatNum = 1; seatNum <= secDef.seatsPerRow; seatNum++) {
        const rowLabel = String.fromCharCode(64 + row); // A, B, C...
        const seat_id = `${secDef.section_id}-R${rowLabel}-S${seatNum}`;

        // Calculate seat coordinates (arc-based offset from section center)
        const rowOffset = (row - 1) / secDef.rows;
        const seatAngle = ((seatNum - 1) / (secDef.seatsPerRow - 1) - 0.5) * 0.05;
        const lng = secDef.centerLng + rowOffset * 0.001 * Math.cos(seatAngle);
        const lat = secDef.centerLat + rowOffset * 0.001 * Math.sin(seatAngle);

        const statusIdx = Math.floor(Math.random() * SEAT_STATUSES.length);
        const status = SEAT_STATUSES[statusIdx];

        // Slight price variation per row (closer to field = premium)
        const rowPriceFactor = 1 + (secDef.rows - row) * 0.02;
        const price = Math.round(basePrice * rowPriceFactor);

        seatsToCreate.push({
          seat_id,
          sectionId: section.id,
          row: rowLabel,
          number: seatNum,
          x: seatNum * 20,
          y: row * 20,
          lng,
          lat,
          geometry: {
            type: 'Point',
            coordinates: [lng, lat],
          },
          price,
          status,
        });
        totalSeats++;
      }
    }

    await prisma.seat.createMany({ data: seatsToCreate });
  }

  console.log(`✅ Created ${stadiumSections.length} sections with ${totalSeats} seats`);
  console.log(`\n🎉 Seed complete!`);
  console.log(`   Event ID: ${event.id}`);
  console.log(`   Layout ID: ${layout.id}`);
  console.log(`   Total sections: ${stadiumSections.length}`);
  console.log(`   Total seats: ${totalSeats}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error('❌ Seed failed:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
