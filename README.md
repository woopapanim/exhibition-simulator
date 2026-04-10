# Exhibition Simulator

전시관 관람객 트래픽 시뮬레이터 — 전시 공간 설계 및 운영 최적화 도구

## 개요

전시관의 관람객 동선, 미디어 체험, 병목 현상을 시뮬레이션하여 전시 운영 효율을 분석합니다.

## 주요 기능

- **Build** — 전시 공간 설계 (존 배치, 미디어 배치, 다층 구조)
- **Simulate** — 시간대별 관람객 시뮬레이션 (배속 1x~10x)
- **Analyze** — 히트맵 및 구역별 밀집도 분석
- **Report** — 스킵율, 몰입 강도, 병목 발생 리포트

## 기술 스택

- React + Vite
- Zustand (상태 관리)
- Canvas 2D API (렌더링)
- Chart.js (리포트 차트)
- shadcn/ui 디자인 시스템

## 시작하기

```bash
npm install
npm run dev
```

## 빌드

```bash
npm run build
```

## 스크린샷

> Build → Simulate → Analyze → Report 순으로 전시 운영을 시뮬레이션합니다.
