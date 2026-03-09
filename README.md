# my-obsidian

Obsidian vault를 GitHub Pages 블로그로 변환하는 CLI 도구입니다.

## 특징

- **WikiLink 지원**: `[[링크]]` 형식의 Obsidian 스타일 링크 자동 변환
- **이미지 임베드**: `![[image.png]]` 형식의 이미지 자동 삽입
- **Callout 지원**: `> [!note]` 형식의 Obsidian callout 변환
- **Frontmatter**: YAML frontmatter로 메타데이터 관리
- **코드 하이라이팅**: 자동 구문 강조
- **미니멀 디자인**: 깔끔한 타이포그래피, 다크모드 지원
- **GitHub Actions**: 자동 배포 지원

## 설치

```bash
npm install -g my-obsidian
```

## 사용법

### 기본 사용

```bash
my-obsidian build --source ./vault --output ./dist
```

### 옵션

```bash
my-obsidian build [options]

Options:
  -s, --source <path>        Source vault directory
  -o, --output <path>        Output directory (default: "./dist")
  -e, --exclude <patterns>   Exclude directories/files
  -c, --config <path>        Configuration file
  --base-path <path>         Base path for URLs (default: "/")
  --template <name>          Template to use (default: "default")
```

### 설정 파일 생성

```bash
my-obsidian init
```

이 명령어는 `obsidian.config.json` 파일을 생성합니다:

```json
{
  "source": "./vault",
  "output": "./dist",
  "exclude": [".obsidian", ".trash"],
  "basePath": "/",
  "template": "default",
  "site": {
    "title": "My Digital Garden",
    "description": "My notes published from Obsidian",
    "author": ""
  },
  "markdown": {
    "preserveWikiLinks": false,
    "convertCallouts": true,
    "syntaxHighlighting": true
  },
  "features": {
    "generateIndex": true,
    "generateSitemap": true,
    "copyAssets": true
  }
}
```

설정 파일을 사용하여 빌드:

```bash
my-obsidian build --config obsidian.config.json
```

이 경우 `obsidian.config.json` 안에 `source`가 포함되어 있어야 합니다. `--source`를 함께 지정하면 설정 파일의 값을 덮어씁니다.

## GitHub Pages 배포

### 1. GitHub Repository 설정

1. GitHub에 새 repository 생성
2. Settings → Pages → Source를 "GitHub Actions"로 설정

### 2. Workflow 파일 추가

`.github/workflows/deploy.yml` 파일 생성:

```yaml
name: Deploy Obsidian to GitHub Pages

on:
  push:
    branches: [main]

permissions:
  contents: read
  pages: write
  id-token: write

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm install -g my-obsidian
      - run: my-obsidian build --source ./vault --output ./dist --base-path /your-repo-name/
      - uses: actions/upload-pages-artifact@v3
        with:
          path: ./dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/deploy-pages@v4
```

### 3. vault 디렉터리 구조

```
your-repo/
├── .github/
│   └── workflows/
│       └── deploy.yml
├── vault/
│   ├── README.md
│   ├── Note 1.md
│   └── Note 2.md
└── obsidian.config.json (optional)
```

### 4. Push하여 배포

```bash
git add .
git commit -m "Deploy Obsidian vault to GitHub Pages"
git push origin main
```

GitHub Actions가 자동으로 실행되어 사이트가 배포됩니다!

### 5. basePath 설정

GitHub Pages URL 형태에 따라 `basePath`를 맞춰야 정적 리소스와 graph view가 정상 동작합니다.

- User/Organization site: `https://<user>.github.io/`
  - `basePath: "/"`
- Project site: `https://<user>.github.io/<repo>/`
  - `basePath: "/<repo>/"`

예를 들어 repository가 `your-repo-name`이고 배포 URL이 `https://<user>.github.io/your-repo-name/` 라면 아래 둘 중 하나로 빌드해야 합니다.

```bash
my-obsidian build --source ./vault --output ./dist --base-path /your-repo-name/
```

```json
{
  "source": "./vault",
  "output": "./dist",
  "basePath": "/your-repo-name/"
}
```

`site.url`을 사용하는 경우에는 `https://<user>.github.io/your-repo-name` 로 설정하세요.

## Obsidian 기능 지원

### WikiLinks

```markdown
[[Another Note]]
[[Another Note|Custom Text]]
```

→ HTML 링크로 자동 변환

### 이미지 임베드

```markdown
![[image.png]]
```

→ `<img>` 태그로 변환

### Callouts

```markdown
> [!note]
> This is a note callout

> [!warning]
> This is a warning callout
```

→ 스타일링된 `<div>` 블록으로 변환

지원하는 callout 타입: note, tip, important, warning, caution, info, success, question, failure, danger, bug, example, quote

### Frontmatter

```markdown
---
title: My Note
date: 2026-03-09
tags: [tag1, tag2]
description: Short description
---

# Content here
```

## 출력 구조

```
dist/
├── index.html              # 인덱스 페이지
├── mynote.html             # MyNote.md
├── another-note.html       # Another Note.md
├── assets/
│   ├── images/             # 이미지
│   └── styles/
│       └── main.css        # 스타일시트
└── sitemap.xml             # 사이트맵
```

## 로컬 테스트

생성된 사이트를 로컬에서 확인하려면:

```bash
# Python 사용
cd dist
python -m http.server 8000

# Node.js 사용 (npx http-server)
npx http-server dist -p 8000
```

브라우저에서 `http://localhost:8000` 접속

## 개발

```bash
# Repository 클론
git clone https://github.com/yourusername/my-obsidian.git
cd my-obsidian

# 의존성 설치
npm install

# TypeScript 빌드
npm run build

# 개발 모드 (watch)
npm run dev

# 린트
npm run lint

# 테스트
npm test
```

## 라이선스

MIT

## 기여

이슈와 Pull Request는 환영합니다!

## 로드맵

- [ ] 태그 페이지 생성
- [ ] 검색 기능
- [ ] 그래프 뷰
- [ ] 커스텀 테마 지원
- [ ] 플러그인 시스템
