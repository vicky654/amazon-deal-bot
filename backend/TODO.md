# Amazon Affiliate Link Implementation Plan

Current step: ✅ Planning complete and approved.

## Breakdown of Implementation Steps:

### 1. ✅ COMPLETE - backend/utils/affiliate.js created with buildAffiliateLink() & extractAsin()

### 2. [PENDING] Update Deal model
- Edit `backend/models/Deal.js`
- Add `asin` field with index
- Update schema indexes

### 3. [PENDING] Update server.js logic
- Edit `backend/server.js`
- Import affiliate utils
- In `/generate`: extract ASIN, dup check on ASIN, set product.link = affiliateLink before save
- Ensure `/telegram` uses affiliate link (auto via input)

### 4. [PENDING] Test integration
- POST /generate with sample Amazon URL
- Verify: ASIN extracted, affiliate link saved, dup check works
- POST /telegram: Buy Now shows affiliate link

### 5. [PENDING] Final verification
- Check MongoDB: new deals have asin + affiliate link
- Test duplicate ASIN (different input URLs)
- Confirm Telegram caption uses affiliate format

**Next action: Proceed to Step 1 after tool confirmation.**
