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
