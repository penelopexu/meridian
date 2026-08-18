# 部署到 GitHub Pages

仓库已经 `git init` 并 `git add` 好了，只差第一次提交和推送。

## 一次性设置

### 1. 在 GitHub 网页上建一个空仓库

打开 https://github.com/new

- **Repository name**：`meridian`（或你喜欢的名字）
- **Public / Private**：选 **Public**。私有仓库开 GitHub Pages 需要付费账户
- **不要**勾选 "Add a README file"、"Add .gitignore"、"Choose a license" —— 这三个都留空，否则会和本地冲突

建完先别关页面，下一步要用到它给的地址。

### 2. 本地提交并推送

在项目目录（`D:\Files\Projects\gadgets\tianshi`，本地文件夹名不必跟仓库名一致）打开终端（PowerShell 或 Git Bash），依次执行：

```bash
git add -A
git commit -m "天时：万年历 + 天气 + 历史气候"
git branch -M main
git remote add origin https://github.com/penelopexu/meridian.git
git push -u origin main
```

第四条会让你登录。GitHub 从 2021 年起不接受账号密码，密码框要填 **Personal Access Token**：
头像 → Settings → Developer settings → Personal access tokens → Tokens (classic) → Generate new token，勾选 `repo` 权限，生成后复制粘贴进去。Windows 一般会记住，只需输一次。

### 3. 打开 Pages

仓库页面 → **Settings** → 左侧 **Pages** → **Source** 选 **GitHub Actions**（不是 "Deploy from a branch"）。

选完就没别的要点了。`.github/workflows/pages.yml` 已经写好，它会自己跑 `node build.mjs` 并把 `dist/pwa` 发布出去。

### 4. 等两分钟

回到仓库的 **Actions** 标签页，能看到一个正在跑的绿色流程。跑完后网址是：

```
https://penelopexu.github.io/meridian/
```

手机浏览器打开这个地址，菜单里选「添加到主屏幕」，就装成 App 了。

---

## 以后怎么更新

改完代码后：

```bash
git add -A
git commit -m "改了什么"
git push
```

推上去自动重新构建部署，一两分钟生效。已安装的 PWA 会在下次打开时自动更新（Service Worker 里加了 `controllerchange` 自动刷新）。

---

## 常见问题

**推送时报 `rejected` / `non-fast-forward`**
说明远程仓库不是空的（多半是建仓库时勾了 README）。执行：
```bash
git pull --rebase origin main
git push -u origin main
```

**Actions 里流程失败**
点进去看日志。最常见的是第 3 步没选 "GitHub Actions" 而选了 "Deploy from a branch"，回 Settings → Pages 改过来再去 Actions 点 "Re-run jobs"。

**页面打开是 404**
Pages 首次生效有延迟，等 2–3 分钟刷新。仍然不行就确认 Settings → Pages 顶部显示了绿色的 "Your site is live at ..."。

**样式全丢了 / 图标 404**
检查 Actions 日志里 `node build.mjs` 那一步有没有报错。`dist/` 是 `.gitignore` 掉的，不会也不该提交，全靠 CI 生成。

**想改仓库名**
Pages 网址里的路径就是仓库名。改名后网址跟着变，`start_url` 用的是相对路径 `./`，不受影响。

---

## 不想用 GitHub 也行

`dist/天时-单文件.html` 是完全自包含的，双击就能用，发微信、拷 U 盘、放网盘都行。跑一次 `node build.mjs` 就能重新生成。
