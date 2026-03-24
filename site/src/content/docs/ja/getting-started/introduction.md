---
title: はじめに
description: Solidionとは何か、なぜ使うのか
---

Solidionは[SolidJS](https://www.solidjs.com/)のユニバーサルレンダラーをベースに構築された[Phaser 3](https://phaser.io/)用カスタムレンダラーです。宣言的なJSXときめ細かいリアクティビティを使ってPhaserゲームを構築できます。

## なぜSolidion？

- **仮想DOMなし** — SolidJSがDOM要素を直接操作するのと同様に、Phaser GameObjectsを直接操作
- **きめ細かいリアクティビティ** — 変更されたプロパティだけが更新され、差分比較のオーバーヘッドなし
- **馴染みやすいDX** — SolidJSとPhaserを知っていれば、すぐに使い始められる
- **段階的な公開API** — シンプルなJSXから始めて、必要に応じてより深いレベルへ

## アーキテクチャ

Solidionはレイヤードアーキテクチャに従います：

| レイヤー | 内容 | 例 |
|---------|------|-----|
| **L0** | JSXプリミティブ | `<sprite>`, `<text>`, `<rectangle>` |
| **L1** | Hooks & Behaviors | `useTween()`, `useSpring()`, `<SpringBehavior>` |
| **L2** | Resources | シーン対応の非同期ローディング |
| **L3** | Frame | フレームごとの更新ループ |
| **L4** | Raw Phaser | Phaser APIへの直接アクセス |

## 次のステップ

- [インストール](/ja/getting-started/installation/) — プロジェクトへの導入手順
- [クイックスタート](/ja/getting-started/quick-start/) — 最初のゲームを作ってみる
