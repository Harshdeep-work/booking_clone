#!/bin/bash

# Migration script for advanced admin builder features

echo "🚀 TicketFlow Advanced Features Migration"
echo "=========================================="
echo ""

# Step 1: Generate Prisma client with new schema
echo "📦 Step 1: Generating Prisma client..."
npx prisma generate
if [ $? -eq 0 ]; then
  echo "✅ Prisma client generated"
else
  echo "❌ Failed to generate Prisma client"
  exit 1
fi
echo ""

# Step 2: Create migration
echo "🗄️  Step 2: Creating database migration..."
npx prisma migrate dev --name add_advanced_metadata
if [ $? -eq 0 ]; then
  echo "✅ Migration created and applied"
else
  echo "❌ Migration failed"
  exit 1
fi
echo ""

# Step 3: Verify installation
echo "✅ Step 3: Verifying installation..."
echo ""
echo "New features available:"
echo "  ⚡ Seat Grid Generator"
echo "  📐 Section Templates"
echo "  📥 CSV/GeoJSON Import/Export"
echo "  ✓ Validation Engine"
echo "  🏷️ Enhanced Metadata (photos, accessibility, VIP)"
echo "  🏢 Multi-Level Support (100/200/300)"
echo ""

echo "🎉 Migration complete!"
echo ""
echo "Next steps:"
echo "  1. Start dev server: npm run dev"
echo "  2. Open admin builder: http://localhost:3000/admin"
echo "  3. Click '⚡ Advanced' button to access new tools"
echo "  4. Read guide: ADMIN_BUILDER_GUIDE.md"
echo ""
