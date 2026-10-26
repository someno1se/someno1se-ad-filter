# someno1se-ad-filter

High-performance unified DNS adblock filter list for Pi-hole, AdGuard Home, AdGuard app, and uBlock Origin.

[![Build & Deploy](https://github.com/someno1se/someno1se-ad-filter/actions/workflows/build-and-deploy.yml/badge.svg)](https://github.com/someno1se/someno1se-ad-filter/actions)
![Rules Count](https://img.shields.io/badge/Rules-1.3M%2B-blue?style=flat)
![Pi-hole Ready](https://img.shields.io/badge/Pi--hole-Ready-black)
![AdGuard Ready](https://img.shields.io/badge/AdGuard-Ready-black)

---

## Subscription URLs

### 1. Pi-hole (Gravity)
* Format: Plain domain per line
* URL: `https://someno1se.github.io/someno1se-ad-filter/domains.txt`
* Standard hosts (0.0.0.0) format: `https://someno1se.github.io/someno1se-ad-filter/hosts.txt`

### 2. AdGuard / AdGuard Home / uBlock Origin
* Format: Adblock syntax (`||domain^`)
* URL: `https://someno1se.github.io/someno1se-ad-filter/filter.txt`

---

## Pi-hole Setup

1. Open Pi-hole Web Admin (`http://pi.hole/admin`)
2. Go to **Adlists**
3. Paste the URL into the **Address** field:
   ```text
   https://someno1se.github.io/someno1se-ad-filter/domains.txt
   ```
4. Click **Add**, then update gravity:
   ```bash
   pihole -g
   ```

---

## AdGuard Setup

1. **AdGuard Home**:
   * Filters -> DNS blocklists -> Add blocklist -> Paste `filter.txt` URL
2. **AdGuard App (Windows / Android / iOS / Mac)**:
   * Settings -> DNS protection -> DNS Filters -> Add filter -> Paste `filter.txt` URL
3. **uBlock Origin**:
   * Dashboard -> Filter lists -> Import -> Paste `filter.txt` URL

---

## Sources

This filter compiles and deduplicates rules from:
1. `rules/my-rules.txt` (Local priority rules)
2. `KOR: filterslist-KO DNS (filter_25)`
3. `HaGeZi Multi Ultimate`
4. `OISD Big`
5. `1Hosts (Xtra)`
6. `StevenBlack Unified Extended`
7. `AdGuard DNS Base Filter`

---

## Custom Rules & Whitelist

* To block additional domains: Add domains to [`rules/my-rules.txt`](rules/my-rules.txt)
* To unblock false positives: Add domains to [`rules/whitelist.txt`](rules/whitelist.txt)
* Push changes to `main` branch to trigger automated compilation and deployment.
