# 发布清单（dsh-drag-workspace）

当前状态：代码、测试、打包都已就绪，`pnpm pack` 产物在仓库根目录
（`dsh-drag-workspace-0.2.0.tgz`，约 72 KB）。剩下的是需要账号和网络的动作。

## 0. 前置

这台机器目前**没有 `git`、没有 `npm`/`npx`**，`~/.npmrc` 也不存在。发布前二选一：

- 装 Git for Windows + Node.js（自带 npm），或
- 只用 pnpm（已有）：`node <pnpm.mjs> publish`，凭证写进 `~/.npmrc`。

## 1. 仓库与元数据（已完成）

仓库：<https://github.com/Mike2233666/dsh-drag-workspace>

`package.json` 已补：

```json
"repository": { "type": "git", "url": "git+https://github.com/Mike2233666/dsh-drag-workspace.git" },
"homepage": "https://github.com/Mike2233666/dsh-drag-workspace#readme",
"bugs": { "url": "https://github.com/Mike2233666/dsh-drag-workspace/issues" }
```

首次推送（装好 git 后）：

```bash
cd dsh-drag-workspace
git init
git add .
git commit -m "dsh-drag-workspace 0.2.0"
git branch -M main
git remote add origin https://github.com/Mike2233666/dsh-drag-workspace.git
git push -u origin main
```

## 2. 发布到 npm

在 <https://www.npmjs.com/settings/~/tokens> 建一个 Automation token，写进 `~/.npmrc`：

```ini
//registry.npmjs.org/:_authToken=<token>
```

然后：

```bash
cd dsh-drag-workspace
pnpm publish --access public --no-git-checks
```

或装好 npm 后 `npm publish --access public`。

发布后验证：

```bash
npm view dsh-drag-workspace version dist.tarball
```

## 3. 干净环境安装验证

```bash
dsh plugin --profile web add dsh-drag-workspace
```

1. 重启 `dsh web`；
2. 侧栏把一个会话拖到另一个 workspace 标题；
3. 期望：蓝色描边 → 提示「已移动到目标工作区」→ 会话换组；
4. 打开会话，工作目录应为目标路径。

## 4. 收录到市场

### awesome-dsh-plugin

- 仓库：<https://github.com/awesome-dsh-plugin/awesome-dsh-plugin>
- 分类：**Sessions & Messages**
- 条目格式（参考同页其他条目，英文一行）：

```markdown
- [Mike2233666/dsh-drag-workspace](https://github.com/Mike2233666/dsh-drag-workspace) - Drag a session row onto another workspace header to move it: rewrites the session cwd, re-homes the artifact and swaps workspace accounting, with the move pipeline built in.
```

注意：该列表只收录能用 `dsh plugin add` 安装、且描述与源码一致的条目；提交前确认包已发 npm、`dsh.bundle` 声明有效。

### dsh-market

- 仓库：<https://github.com/dsh-market/dsh-market>
- 同样按它的 README 提 PR/条目。

### DSH 插件页「发现」

在 **插件 → 发现 → 索引源** 里加：

```
https://cdn.jsdelivr.net/npm/dsh-plugin-catalog/index.json
```

发布后，这个索引会通过 npm 关键词（`dsh-plugin`、`deepseek-harness`）自动扫到本包；
如果一天后仍搜不到，再按上面两个仓库手动提条目。

## 5. 后续版本

1. 改 `version`，更新 `CHANGELOG.md`；
2. `npm run check && npm test`；
3. `pnpm pack` 检查 tarball 内容；
4. `pnpm publish`；
5. 若同步了上游 vendored 代码，在 CHANGELOG 里写明基线版本。

## 已打包验证

- `pnpm pack` → 73 KB，包含 `lib/`（含 vendor）、`cordis.patch.yml`、双 README、
  CHANGELOG、LICENSE、`docs/`；
- 把 tarball 装进临时工程后 `import("dsh-drag-workspace")` + `apply(fakeCtx)` 通过，
  路由注册正常；
- 三个测试：客户端拖拽、宿主启动、真实 artifact 移动（临时 `DSH_HOME`）。
