# 🛡️ someno1se-ad-filter

> **광고, 추적기, 피싱, 악성코드를 모조리 박멸하는 초고성능 DNS 통합 차단 필터**  
> Pi-hole, AdGuard Home, AdGuard 앱, uBlock Origin 완벽 지원!

[![Build & Deploy](https://github.com/someno1se/someno1se-ad-filter/actions/workflows/build-and-deploy.yml/badge.svg)](https://github.com/someno1se/someno1se-ad-filter/actions)
![Rules Count](https://img.shields.io/badge/Rules-1.3M%2B-blue?style=flat&logo=shield)
![Pi-hole Ready](https://img.shields.io/badge/Pi--hole-Ready-ea2328?logo=raspberry-pi)
![AdGuard Ready](https://img.shields.io/badge/AdGuard-Ready-2ecc71?logo=adguard)

---

## 🚀 구독 링크 (Subscription URLs)

GitHub Pages 배포 후 아래 링크를 복사하여 사용하세요:

### 🍓 1. 파이홀 (Pi-hole Gravity 전용)
* **포맷**: 1줄 1도메인 (순수 호스트네임)
* **URL**: `https://someno1se.github.io/someno1se-ad-filter/domains.txt`
* *(표준 0.0.0.0 포맷이 필요할 경우: `https://someno1se.github.io/someno1se-ad-filter/hosts.txt`)*

### 🛡️ 2. AdGuard / AdGuard Home / uBlock Origin 전용
* **포맷**: Adblock DNS Syntax (`||domain.com^`)
* **URL**: `https://someno1se.github.io/someno1se-ad-filter/filter.txt`

---

## 🍓 파이홀(Pi-hole) 등록 방법

1. Pi-hole 웹 관리자 페이지 접속 (`http://pi.hole/admin`)
2. 좌측 메뉴에서 **Adlists** 이동
3. **Address** 항목에 아래 주소 입력:
   ```text
   https://someno1se.github.io/someno1se-ad-filter/domains.txt
   ```
4. **Add** 버튼 클릭
5. 터미널에서 Gravity 갱신:
   ```bash
   pihole -g
   ```
   *(또는 Pi-hole 웹 콘솔 -> Tools -> **Update Gravity** 클릭)*

---

## 🛡️ AdGuard Home & 앱 등록 방법

1. **AdGuard Home**:
   * *필터* &rarr; *DNS 차단 목록* &rarr; *차단 목록 추가* &rarr; `filter.txt` URL 입력
2. **AdGuard 앱 (Windows / Android / iOS / Mac)**:
   * *설정* &rarr; *DNS 보호* &rarr; *DNS 필터* &rarr; *필터 추가* &rarr; `filter.txt` URL 입력
3. **uBlock Origin**:
   * *설정* &rarr; *필터 목록* &rarr; 하단 *가져오기...* &rarr; `filter.txt` URL 입력 후 저장

---

## 📦 포함된 소스 (Sources)

이 필터는 7개의 검증된 대형 소스를 병렬로 수집하여 중복을 제거하고 알파벳순으로 정렬합니다:

1. **`rules/my-rules.txt`**: DoubleClick 및 개인 지정 최우선 박멸 룰
2. **KOR: filterslist-KO DNS (`filter_25.txt`)**: 한국 웹사이트 전용 광고/추적기 필터
3. **HaGeZi Multi Ultimate**: 전 세계 1위 DNS 필터 (오탐 제어 최고 수준)
4. **OISD Big**: 인터넷 정상 사용(결제, 로그인 등)을 방해하지 않는 표준 필터
5. **1Hosts (Xtra)**: 공격적인 광고/트래커/텔레메트리 차단
6. **StevenBlack Unified Extended**: 애드웨어, 가짜뉴스, 도박/성인 스팸 도메인
7. **AdGuard DNS Base Filter**: AdGuard 본사 공식 DNS 필터

---

## 🛠️ 내가 직접 룰 추가 / 수정하는 법

1. **차단 도메인 추가**:
   * [`rules/my-rules.txt`](rules/my-rules.txt) 파일에 차단하고 싶은 도메인을 한 줄에 하나씩 적고 Git Commit & Push!
2. **오탐(정상 사이트 차단) 해결**:
   * [`rules/whitelist.txt`](rules/whitelist.txt) 파일에 허용할 정상 도메인을 추가하고 Git Commit & Push!
3. **자동 빌드 & 배포**:
   * GitHub에 Push하면 **GitHub Actions**가 자동으로 빌드하여 1분 이내에 GitHub Pages를 갱신합니다.
   * 매일 새벽 3시(KST)에도 최신 업스트림 목록을 자동으로 가져와 갱신합니다.

---

## 💻 로컬에서 직접 빌드하기

```bash
# 빌드 실행 (약 5~7초 소요)
npm run build
```

빌드가 끝나면 `dist/` 폴더에 `filter.txt`, `domains.txt`, `hosts.txt`, `index.html`이 생성됩니다.
