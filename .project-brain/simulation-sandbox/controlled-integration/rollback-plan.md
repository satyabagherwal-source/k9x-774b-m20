# Safe Byte-Level Rollback Plan for Master Brain Knowledge Integration

## 1. Safety Envelope & Pre-Condition Invariant
**ZERO PRODUCTION WRITES HAVE OCCURRED.**  
All proposed knowledge is currently staged inside:
`.project-brain/simulation-sandbox/controlled-integration/`

If human approval is NOT granted:
- Zero rollback actions are required for production files, because all production files remain 100% bitwise unmodified.
- To purge the staging package, delete `.project-brain/simulation-sandbox/controlled-integration/`.

## 2. Verified Non-Destructive Restore Procedure (Zero Git Reliance)
If human authorization is granted and integration is applied, **DO NOT USE `git checkout --` or `git restore`**, as blanket Git commands will wipe out unrelated user modifications in the working tree.

Instead, execute the verified byte-level restore script:

### A. Restoring 05_KNOWLEDGE/engineering-patterns.md
1. **Verified Pre-Change Snapshot**:
   `.project-brain/simulation-sandbox/controlled-integration/backups/05_KNOWLEDGE_engineering-patterns.md.bak.6ea819849e8b3ef7`
2. **Pre-Change Bitwise SHA-256**:
   `6ea819849e8b3ef74b5654f16b1a6ff0f2d833d6d8eb536dc8c5b9947c98aa04`
3. **Safe Node.js Restore Command**:
   ```bash
   node -e "
   const fs = require('fs');
   fs.copyFileSync(
     '.project-brain/simulation-sandbox/controlled-integration/backups/05_KNOWLEDGE_engineering-patterns.md.bak.6ea819849e8b3ef7',
     '05_KNOWLEDGE/engineering-patterns.md'
   );
   console.log('Restored 05_KNOWLEDGE/engineering-patterns.md from bitwise snapshot.');
   "
   ```
4. **Verification**:
   Verify that `05_KNOWLEDGE/engineering-patterns.md` hash matches `6ea819849e8b3ef74b5654f16b1a6ff0f2d833d6d8eb536dc8c5b9947c98aa04`.

### B. Removing Newly Created Files
Delete only the specific files created during integration, preserving all other files:
```bash
node -e "
const fs = require('fs');
if (fs.existsSync('03_SKILLS/cli-command-dispatcher.md')) fs.unlinkSync('03_SKILLS/cli-command-dispatcher.md');
if (fs.existsSync('08_VERIFICATION/contracts/schema-invariant-validator.md')) fs.unlinkSync('08_VERIFICATION/contracts/schema-invariant-validator.md');
console.log('Removed staged integration files safely.');
"
```

### C. KHU-005 Record Safety Assurance
- The 5 pending duplicate records (`DOM-H-94C4B932`, `DOM-H-2007DF83`, `DOM-H-7D0B9F17`, `DOM-H-C2A738D4`, `DOM-H-1B2AC6F8`) are untouched by this integration and require zero rollback.
