# 发布清单（dsh-drag-workspace）

当前状态：代码、测试、打包都已就绪，`pnpm pack` 产物在仓库根目录
（`dsh-drag-workspace-0.2.0.tgz`，约 72 KB）。剩下的是需要账号和网络的动作。

## 0. 前置（本机环境，2026-11-17 实测）

工具都在便携目录里，且已写进用户 PATH（新开的终端可直接用）：

| 工具 | 路径 | 版本 |
| --- | --- | --- |
| git | `C:\Users\HUAWEI\Tools\PortableGit\cmd\git.exe` | 2.56.1 |
| npm | `C:\Users\HUAWEI\Tools\npm\bin\npm.cmd` | 12.2.2 |
| node | DSH 运行时自带（`~\.dsh\dsh-runtimes\...\node\bin`） | 24.x / 26.x |

凭证在 `~/.npmrc`：

```ini
//registry.npmjs.org/:_authToken=<token>
```

**坑：账号开了 2FA 时，普通 granular token 发布会被拒**：

```
403 ... Two-factor authentication or granular access token with bypass 2fa enabled is required
```

解决：用 **Classic → Automation** token，或在 granular token 上勾选 **Bypass 2FA**
（需要发布权限 + 读改该包）。否则每次都得 `npm publish --otp=<6 位码>`。

当前 DSH 会话里的 pwsh 若报 `git`/`npm` 不存在，是进程继承了旧 PATH，
在命令里前置路径即可：

```powershell
$env:Path = "C:\Users\HUAWEI\Tools\npm\bin;C:\Users\HUAWEI\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin;C:\Users\HUAWEI\Tools\PortableGit\cmd;" + $env:Path
```

## 1. 仓库与元数据（已完成）

仓库：<https://github.com/Mike2233666/dsh-drag-workspace>

`package.json` 已补：

```json
"repository": { "type": "git", "url": "git+https://github.com/Mike2233666/dsh-drag-workspace.git" },
"homepage": "https://github.com/Mike2233666/dsh-drag-workspace#readme",
"bugs": { "url": "https://github.com/Mike2233666/dsh-drag-workspace/issues" }
```

首次推送：**已完成**。`main` 与远端一致，提交 `43b2f01`（`dsh-drag-workspace 0.2.0`，
27 个文件；`*.tgz` 被 `.gitignore` 排除）。远端仓库 public，默认分支 `main`。

以后改动的常规流程：

```bash
cd dsh-drag-workspace
git add -A
git commit -m "…"
git push
```

> 提交作者用的是本地仓库配置里的 `Mike2233666 <Mike2233666@users.noreply.github.com>`
> （`git config --local user.name/email`），没有全局身份。

## 2. 发布到 npm

包已上线：<https://www.npmjs.com/package/dsh-drag-workspace>（首个公开版本 `0.2.0`，
随后 `0.2.1`）。

凭证写在 `~/.npmrc`：

```ini
//registry.npmjs.org/:_authToken=<token>
```

本地发布（当前可用，不需要验证码）：

```bash
cd dsh-drag-workspace
npm publish --access public
```

发布后回读 registry 验证（比 CLI 的自述可靠——首次发布时 PUT 返回 `202`，
要等一两分钟版本才真正出现）：

```powershell
$p = Invoke-RestMethod 'https://registry.npmjs.org/dsh-drag-workspace'
$p.'dist-tags'.latest
$p.versions.'<版本>'.dist.integrity   # 应等于本地 npm pack 输出的 integrity
```

### 已踩过的坑（2026-11）

1. **账号开了 2FA 时普通 granular token 不能发布**：
   `403 ... granular access token with bypass 2fa enabled is required`。
2. **bypass-2FA token 能直发，但不能改信任关系**：
   `403 Granular Access Tokens that bypass two-factor authentication may not perform this action`。
   npm 的进度表：bypass token 的账户变更权限 2026-08 起受限，直发权限 2027-01 停止。
3. **新包首次发布会有 `0.0.0-stage` 占位版本**（`Temporary package placeholder for
   staged publishing`），它不会成为 `latest`，不影响安装。

### Trusted Publishing（推荐终点，尚未配置）

`.github/workflows/publish.yml` 已就绪：`workflow_dispatch` 或 `release` 触发，
跑完 `check`/`test` 后 `npm publish --provenance`，不需要任何 token。

配置一次即可（三选一）：

- 网页：<https://www.npmjs.com/package/dsh-drag-workspace/access> →
  **Trusted publishing** → GitHub Actions → Repository
  `Mike2233666/dsh-drag-workspace`、Workflow `publish.yml`、Environment 留空、
  勾 **npm publish**；
- CLI（需要非 bypass 的 granular token）：`npm trust github dsh-drag-workspace
  --file publish.yml --repo Mike2233666/dsh-drag-workspace --allow-publish -y`；
- 两者都需要一次 2FA 确认（浏览器里的指纹/passkey，或验证器 App 的 6 位码）。

前置条件：包必须已存在（已满足）；`npm trust` 要求 npm ≥ 11.15.0。

配置完成后，建议把 bypass-2FA token 全部删除，并且每次发版走 CI。

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
3. `npm publish --dry-run`（或 `npm pack --dry-run`）检查 tarball 内容；
4. 发布：信任关系配好后走 CI（Actions → publish → Run workflow），
   否则本地 `npm publish --access public`；
5. 若同步了上游 vendored 代码，在 CHANGELOG 里写明基线版本。

## 已打包验证

- `pnpm pack` → 73 KB，包含 `lib/`（含 vendor）、`cordis.patch.yml`、双 README、
  CHANGELOG、LICENSE、`docs/`；
- 把 tarball 装进临时工程后 `import("dsh-drag-workspace")` + `apply(fakeCtx)` 通过，
  路由注册正常；
- 三个测试：客户端拖拽、宿主启动、真实 artifact 移动（临时 `DSH_HOME`）。
