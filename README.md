# Memdir

`.local/` 配下に蓄積される CLAUDE 系ワークフローのメモリ・タスク・issue を、VSCode の Activity Bar から素早く閲覧するためのローカル専用拡張機能。

配布想定なし。`code --install-extension memdir.vsix` でローカル導入する。

## 提供する 3 つの Activity Bar コンテナ

| アイコン (codicon) | コンテナ | 表示対象 |
|------------------|---------|---------|
| `notebook` | Memdir Memory | `${MEMORY_DIR}/memory/YYMMDD_<context>/` |
| `list-tree` | Memdir Tasks | `${MEMORY_DIR}/tasks/YYMMDD_<task>/` |
| `warning` | Memdir Issues | `${MEMORY_DIR}/issues/<severity>-<perspective>-<title>.md` |

各コンテナは独立しているので Activity Bar 上で個別に並び替え/非表示が可能。

## MEMORY_DIR の検出順序

1. ワークスペース設定 `memdir.directoryPath`
2. プロジェクト直下 `CLAUDE.md` から `MEMORY_DIR: <path>` をパース
3. デフォルト `<workspace_root>/.local`

Multi-root workspace では folder ごとに解決される。

## 設定項目

| キー | デフォルト | 説明 |
|------|----------|------|
| `memdir.directoryPath` | `""` | MEMORY_DIR を直接指定（相対 or 絶対） |
| `memdir.issues.groupBy` | `"severity"` | Issues View のグループ化軸 (`severity` or `perspective`) |
| `memdir.issues.hideEmptyGroups` | `true` | 空グループを非表示 |
| `memdir.sort.directories` | `"updated"` | memory/tasks ディレクトリの並び順 (`updated` or `name`) |

## 標準ファイルのハードコード認識

### Memory View

| ファイル | アイコン |
|---------|---------|
| `00_spec.md` | note |
| `05_log.md` | history |
| `10_task.md` | checklist |
| `20_survey.md` | search |
| `30_plan.md` | list-ordered |
| `40_progress.md` | pulse |
| `80_review.md` | comment-discussion |
| `90_pr.md` | git-pull-request |
| `99_history.md` | bookmark |
| その他 | `[other]` グループに折りたたみ |

### Tasks View

- `00_plan.md` を最上段固定
- `XX_<subtask>.md` を `XX: <subtask>` のラベルで番号昇順

### Issues View

- ファイル名: `<severity>-<perspective>-<title>.md`
- Severity: `critical | major | minor | trivial`（並び順=色：red/orange/yellow/foreground）
- Perspective: `perf | sec | test | arch | cq | docs`
- 規約外のファイルは `unknown` グループに保管（捨てない）

### ラッパーディレクトリ（`_archive` / `_closed` 等）

`memory/` `tasks/` `issues/` のいずれの直下にも、`YYMMDD_<name>` 規約に従わない**ラッパーディレクトリ**（隠しディレクトリを除く任意の名前。例: `_archive`, `_closed`, `draft`）を**折りたたみ状態で表示**。展開で配下を lazy load し、内部に YYMMDD 規約のエントリがあれば同じレイアウトで再帰表示される。Issues View では、各ラッパー内で Severity/Perspective グループ化が独立して適用される。

## 開発・導入手順

### 必要環境
- bun >= 1.0
- VSCode >= 1.84

### セットアップ

```bash
bun install
```

### 開発中のコマンド

```bash
bun run typecheck   # tsc --noEmit
bun run lint        # biome check
bun run format      # biome format --write
bun run test        # vitest
bun run build       # esbuild バンドル → dist/extension.js
bun run watch       # esbuild watch モード
```

### F5 デバッグ実行

1. VSCode で本リポジトリを開く
2. `bun run build` 実行（または `bun run watch` で監視）
3. `F5` で Extension Development Host が起動

### ローカル導入（.vsix）

```bash
bun run package                       # memdir.vsix を生成
code --install-extension memdir.vsix  # VSCode にインストール
```

更新時は同じコマンドで上書きインストールされる。アンインストールは VSCode の Extensions ビューから。

## トラブルシュート

- **View に何も表示されない**: MEMORY_DIR が存在しないと空状態になる。`Memdir: Open Settings` で `memdir.directoryPath` を確認
- **CLAUDE.md の MEMORY_DIR が拾われない**: 単純な `MEMORY_DIR: <path>` 形式のみサポート。複雑な記法は `memdir.directoryPath` 設定で上書き
- **ファイル変更が即座に反映されない**: 300ms の debounce あり。それ以上遅い場合は View タイトル行の Refresh ボタン

## ライセンス

Private. 配布しない。
