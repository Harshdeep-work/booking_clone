# 🚀 Quick Reference — Advanced Admin Builder

## 🎯 Access Advanced Tools

**Button Location**: Top-right toolbar → **"⚡ Advanced"**

---

## ⚡ Seat Grid Generator

**Location**: Advanced Tools → **Grid** tab

### Quick Setup:
```
Rows: 10-50
Seats per Row: 1-100
Row Spacing: 12 (default)
Seat Spacing: 10 (default)
Curve Radius: 0 (straight) or 50-500 (curved)
Number Scheme: Sequential / Odd / Even / RTL
```

### Steps:
1. Select a section
2. Open Grid tab
3. Configure settings
4. Click **"Generate Seats"**

**Result**: 500+ seats in <1 second

---

## 📐 Section Templates

**Location**: Advanced Tools → **Templates** tab

### Available Templates:
- **Rectangle** ▭ — Standard blocks
- **Trapezoid** ⏢ — Tapered sections
- **Arc** ◠ — Curved bowls
- **Corner** ⌜ — L-shaped
- **Suite Box** ▢ — VIP suites

### Steps:
1. Click a template
2. Section appears at (100, 100)
3. Drag to position
4. Use Grid Generator to fill

---

## 📥 CSV Import

**Location**: Advanced Tools → **I/O** tab

### CSV Format:
```csv
section_id,row,seat,x,y,price,category,status,accessible,obstructed
101,A,1,120.5,80.3,250,PREMIUM,available,false,false
```

**Required**: `section_id`, `row`, `seat`, `x`, `y`  
**Optional**: `price`, `category`, `status`, `accessible`, `obstructed`

### Steps:
1. Prepare CSV file
2. Click **"Choose File"**
3. Select CSV
4. Seats import instantly

**Performance**: 10,000 seats in ~2 seconds

---

## 📤 Export

**Location**: Advanced Tools → **I/O** tab

### Export Formats:
- **CSV** — Seats with metadata
- **GeoJSON** — Full venue (sections + seats)

### Steps:
1. Click **"Export as CSV"** or **"Export as GeoJSON"**
2. File downloads automatically

---

## ✓ Validation

**Location**: Advanced Tools → **Validate** tab

### Checks:
- ❌ Duplicate seat IDs
- ❌ Seat overlaps (<8 units)
- ❌ Section overlaps
- ❌ Numbering conflicts
- ⚠️ Accessibility (<1%)
- ⚠️ Price variance (>20x)

### Steps:
1. Click **"Run Validation"**
2. Review errors (red) and warnings (yellow)

---

## 🏷️ Enhanced Properties

**Location**: Right sidebar (toggle Classic/Enhanced)

### Section Properties:
- **Venue Level**: 100/200/300/SUITE/CLUB
- **Curve Radius**: 0-1000
- **Photo Upload**: Seat view images
- **Flags**: ♿ Accessible, ⚠️ Obstructed

### Row Properties:
- **Price Override**: Custom row pricing
- **Curve Radius**: Individual row curves
- **Stats**: Seat count, avg price

### Seat Properties:
- **Price**: Individual pricing
- **Status**: Available/Sold/Locked/Obstructed
- **Flags**:
  - ♿ Wheelchair Accessible
  - 👥 Companion Seat
  - ⚠️ Obstructed View
  - ⭐ VIP / Premium
  - 🚪 Aisle Seat

---

## ⌨️ Keyboard Shortcuts

```
Ctrl+Z        Undo
Ctrl+Y        Redo
Escape        Deselect / Exit section mode
Delete        Delete selected
Alt+Drag      Pan (any tool)
Scroll        Zoom in/out
```

---

## 🎯 Common Workflows

### Build 20,000-Seat Arena (30 min):
1. Load NBA Arena template
2. Select section → Grid Generator (18 rows × 20 seats)
3. Repeat for all sections
4. Set pricing by level
5. Mark accessible seats
6. Upload photos
7. Validate → Export

### Import from CAD (10 min):
1. Export CAD → CSV
2. Import CSV
3. Set pricing
4. Add photos
5. Validate → Export

### Clone Venue (5 min):
1. Export reference → GeoJSON
2. Import to new event
3. Adjust pricing
4. Publish

---

## 📊 Performance Targets

| Operation | Time |
|-----------|------|
| Grid Generate (500 seats) | <1s |
| CSV Import (10,000 seats) | ~2s |
| Validation (20,000 seats) | ~3s |
| GeoJSON Export (20,000 seats) | ~1s |

---

## 🐛 Troubleshooting

### "Select Section First" Error
**Solution**: Click a section polygon before using Grid Generator

### CSV Import Fails
**Solution**: Verify CSV has required columns: `section_id,row,seat,x,y`

### Validation Shows Overlaps
**Solution**: Increase seat spacing or adjust positions manually

### Photo Upload Not Working
**Solution**: Currently uses local URLs. For production, integrate S3/Cloudinary.

---

## 📚 Full Documentation

- **Complete Guide**: `ADMIN_BUILDER_GUIDE.md`
- **Implementation Details**: `IMPLEMENTATION_COMPLETE.md`
- **Checklist**: `IMPLEMENTATION_CHECKLIST.md`

---

## 🎉 Quick Wins

**Generate 500 seats in 3 clicks:**
1. Select section
2. Advanced → Grid
3. Click "Generate Seats"

**Import 10,000 seats in 2 clicks:**
1. Advanced → I/O
2. Choose CSV file

**Validate entire venue in 1 click:**
1. Advanced → Validate → Run

---

**Built for speed. Built for scale. Built like TickPick. 🚀**
