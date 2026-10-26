# someno1se-ad-filter

High-performance unified DNS adblock filter list for Pi-hole, AdGuard Home, AdGuard app, and uBlock Origin.

[![Build & Deploy](https://github.com/someno1se/someno1se-ad-filter/actions/workflows/build-and-deploy.yml/badge.svg)](https://github.com/someno1se/someno1se-ad-filter/actions)
![Rules Count](https://img.shields.io/badge/Rules-1.3M%2B-blue?style=flat)
![Pi-hole Ready](https://img.shields.io/badge/Pi--hole-Ready-black)
![AdGuard Ready](https://img.shields.io/badge/AdGuard-Ready-black)

---

## Subscription URL

* **Format**: Adblock DNS syntax (`||domain^`)
* **URL**:
  ```text
  https://someno1se.github.io/someno1se-ad-filter/filter.txt
  ```

---

## Pi-hole Setup

1. Open Pi-hole Web Admin (`http://pi.hole/admin`)
2. Go to **Adlists**
3. Paste the URL into the **Address** field:
   ```text
   https://someno1se.github.io/someno1se-ad-filter/filter.txt
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

## Custom Rules & Whitelist

* To block additional domains: Add domains to [`rules/my-rules.txt`](rules/my-rules.txt)
* To unblock false positives: Add domains to [`rules/whitelist.txt`](rules/whitelist.txt)
* Push changes to `main` branch to trigger automated compilation and deployment.
