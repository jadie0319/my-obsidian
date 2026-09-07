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
마찬가지로 다른 옵션도 CLI에서 명시적으로 넘긴 값만 설정 파일을 덮어씁니다.

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

### 검색, 목록, 시리즈와 공개 상태

모든 페이지에 전체 글 목록과 제목·본문·태그 검색이 제공됩니다. 검색창은 `Ctrl+K` 또는 `Cmd+K`로 열 수 있고, `#태그` 검색과 방향키·Enter 탐색을 지원합니다. 검색은 정적 JSON을 브라우저에서 불러오며 별도 서버가 필요 없습니다. 한국어도 부분 문자열로 검색합니다.

홈은 소개, 최신 글, 주제, 접이식 그래프 순서입니다. 최신 글에는 생성일·요약·태그·상태를 표시합니다. `description`이 없으면 본문에서 요약을 추출합니다. 전체 글 목록(`/archive.html`)에서는 최신순·제목순 정렬과 태그 필터를 사용할 수 있습니다.

글에는 접이식 모바일 목차, 제목별 링크 복사, 내부 링크 미리보기, 주변 글 그래프가 추가됩니다. 본문의 첫 H1이 페이지 제목과 같으면 중복 표시하지 않습니다. 모바일 터치에서는 링크가 바로 이동합니다.

```yaml
---
title: 리팩터링 시작하기
created: "2026-09-07T10:00:00+09:00"
modified: "2026-09-07T11:00:00+09:00"
description: 리팩터링을 시작하기 전에 알아둘 기본 원칙
tags: [refactoring]
status: budding
series: 리팩터링 스터디
seriesOrder: 1
---
```

- `status`: `seedling`(초기 메모), `budding`(정리 중), `evergreen`(완성)을 표시합니다.
- 같은 `series`의 글은 `seriesOrder` 오름차순으로 연결됩니다. 순서가 같으면 생성일, URL 순으로 정렬합니다. 시리즈 목차와 이전·다음 글이 자동 생성됩니다.
- `draft: true`, `published: false`, 또는 `status: draft`인 글은 HTML·목록·검색·그래프·RSS·사이트맵에서 제외됩니다. 기존에 생성한 글을 초안으로 바꾸면 잔여 HTML도 삭제합니다. 첨부 파일은 기존처럼 복사되므로 민감한 자료는 vault 밖에 보관하세요.
- `created` 최신순으로 정렬하며 없거나 유효하지 않으면 `modified`를 사용합니다. 파일 생성 시각은 CI checkout 시 바뀔 수 있으므로 실제 작성 시각은 frontmatter에 기록하세요.

설정 파일의 선택 항목 `publishing`으로 표시 언어와 홈 순서, 기능을 변경할 수 있습니다. 예시에서 `site.url`은 실제 배포 주소로 바꾸세요.

```json
{
  "source": "./vault",
  "output": "./public",
  "basePath": "/your-repo-name/",
  "site": {
    "title": "My Digital Garden",
    "description": "배우고 연결하며 정리하는 노트",
    "url": "https://your-username.github.io/your-repo-name"
  },
  "publishing": {
    "language": "ko",
    "homeOrder": ["intro", "recent", "topics", "graph"],
    "search": true,
    "previews": true,
    "localGraph": true,
    "rss": true,
    "checkLinks": true,
    "strictLinks": false
  }
}
```

기본 언어는 `en`이며 `ko`도 지원합니다. `homeOrder`에서 섹션을 빼면 해당 섹션이 숨겨집니다. RSS는 `site.url`이 있을 때 `/feed.xml`로 생성되며 최신 50개 글을 포함합니다. 같은 주소를 기준으로 canonical 및 Open Graph 공유 정보를 생성합니다. `site.url`이 없으면 절대 주소가 필요한 RSS와 canonical은 생략됩니다.

빌드 시 내부 링크, 이미지·스크립트·스타일 파일과 제목 앵커를 검사합니다. 외부 사이트는 조회하지 않습니다. 기본은 경고이며, `strictLinks: true`로 설정하면 깨진 링크가 있는 빌드는 실패합니다. `archive.html`, 인덱스 생성 시 `index.html`과 `tags/`는 생성기에서 사용하므로 노트 출력 경로와 겹치면 빌드를 중단합니다.

`assets/search-index.json`과 추가 UI 리소스는 위 기능을 위해 생성됩니다. `.generated-pages.json`은 이전 빌드의 잔여 페이지 정리에 사용하므로 출력 폴더 안에서 유지하세요. 사이트 배포 시에는 빌드 결과 폴더 전체를 업로드하세요.

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
