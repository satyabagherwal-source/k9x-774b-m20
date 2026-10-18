> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/lokoe-mehdi-scouter-learnings.md`  
> **Source**: github (https://github.com/lokoe-mehdi/scouter)  
> **Source Version**: `4de023b517`  
> **License**: MIT  
> **Synthesized By**: Antigravity Deep Forensic Harvester  
> **Timestamp**: 2026-10-18T05:45:00.000Z  
> **Learning ID**: `learn-github-lokoe-mehdi-scouter`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  

---

# Project Learning Record: lokoe-mehdi/scouter

## 1. Executive Forensic Architecture & System Mechanics
Hybrid PHP + Go (`crawler-go`) enterprise crawler with ClickHouse data warehouse and Model Context Protocol (MCP) server.

### Key Architectural Innovations:
1. **64-Bit SimHash Near-Duplicate Detection (`simhash.go`)**:
   - Normalizes text, generates 3-word overlapping shingles, hashes to 64-bit integers, and applies bit-vector voting.
   - O(1) Hamming distance comparisons (`bits.OnesCount64(a ^ b) <= 3`) detect near-duplicate pages across millions of crawled URLs without quadratic pairwise string comparisons.
2. **Dual-Store Architecture (Postgres + ClickHouse)**:
   - ClickHouse stores high-throughput immutable crawl logs and HTTP headers, while PostgreSQL manages projects and configurations.
3. **MCP Integration (`mcp/`)**:
   - Exposes crawl analysis, duplicate clusters, and internal PageRank as tools for autonomous AI agents.

## 2. Promoted Master Brain Rules
- **Rule 1617**: 64-Bit SimHash Bit-Vector Voting for Near-Duplicate Content Detection.