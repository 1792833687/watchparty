#!/usr/bin/env node
/**
 * GitHub API 批量推送脚本（无需 git push，绕过 github.com 主站阻断）
 * 用法: node scripts/github-api-push.mjs <token> <owner> <repo> <branch> <localPath> [excludeDir] [commitMessage]
 * 通过 Git Data API: create blobs -> create tree -> create commit -> update ref
 * 文件清单来自 `git ls-files`（自动遵循 .gitignore），可排除指定顶层目录。
 */
import { readFileSync, statSync, readdirSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const [token, owner, repo, branch, localPath, excludeDir, msg] = process.argv.slice(2);
if (!token || !owner || !repo || !branch || !localPath) {
  console.error('usage: node github-api-push.mjs <token> <owner> <repo> <branch> <localPath> [excludeDir] [msg]');
  process.exit(1);
}

const API = 'https://api.github.com';
const headers = {
  Authorization: `Bearer ${token}`,
  Accept: 'application/vnd.github+json',
  'Content-Type': 'application/json',
};

async function api(method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`${method} ${path} -> ${res.status}: ${err.slice(0, 300)}`);
  }
  return res.json();
}

// 收集 git 已跟踪文件清单（从 GIT_FILE_LIST 环境变量读取，避免 shell 依赖）
function collectFiles(localPath, excludeDir) {
  const listPath = process.env.GIT_FILE_LIST;
  const lines = listPath
    ? readFileSync(listPath, 'utf8').split('\n').map((l) => l.trim()).filter(Boolean)
    : [];
  const out = [];
  for (const rel of lines) {
    if (excludeDir && (rel === excludeDir || rel.startsWith(excludeDir + '/'))) continue;
    const p = join(localPath, rel);
    try {
      if (statSync(p).isFile()) out.push({ path: rel.split(sep).join('/'), file: p });
    } catch {
      // 跳过已删除文件
    }
  }
  return out;
}

// 创建 blobs
async function createBlobs(files) {
  const blobs = [];
  for (const f of files) {
    const content = readFileSync(f.file);
    // 二进制或文本都按 base64 处理（GitHub API 支持）
    const b64 = content.toString('base64');
    const res = await api('POST', `/repos/${owner}/${repo}/git/blobs`, { content: b64, encoding: 'base64' });
    blobs.push({ sha: res.sha, path: f.path });
    process.stdout.write(`blob ${blobs.length}/${files.length} ${f.path}\r`);
  }
  console.log('');
  return blobs;
}

async function main() {
  const files = collectFiles(localPath, excludeDir);
  console.log(`总文件数: ${files.length}`);

  // 1. 取现有 HEAD（如果分支已存在）或创建新分支
  let baseSha = null;
  try {
    const ref = await api('GET', `/repos/${owner}/${repo}/git/ref/heads/${branch}`);
    baseSha = ref.object.sha;
    console.log('分支已存在, base commit:', baseSha.slice(0, 8));
  } catch (e) {
    console.log('分支不存在, 将创建新分支');
  }

  // 2. 创建 blobs
  console.log('创建 blobs...');
  const blobs = await createBlobs(files);

  // 3. 创建 tree
  const treeItems = blobs.map((b) => ({ path: b.path, mode: '100644', type: 'blob', sha: b.sha }));
  console.log('创建 tree...');
  const tree = await api('POST', `/repos/${owner}/${repo}/git/trees`, {
    base_tree: baseSha || undefined,
    tree: treeItems,
  });
  console.log('tree:', tree.sha.slice(0, 8));

  // 4. 创建 commit
  const defaultMsg = msg || `feat: 部署 AI Narrator Game 到 GitHub Pages (${new Date().toISOString().slice(0, 10)})`;
  console.log('创建 commit...');
  const commit = await api('POST', `/repos/${owner}/${repo}/git/commits`, {
    message: defaultMsg,
    tree: tree.sha,
    parents: baseSha ? [baseSha] : [],
  });
  console.log('commit:', commit.sha.slice(0, 8));

  // 5. 更新 ref
  console.log('更新 ref...');
  if (baseSha) {
    await api('PATCH', `/repos/${owner}/${repo}/git/refs/heads/${branch}`, {
      sha: commit.sha,
      force: true,
    });
  } else {
    await api('POST', `/repos/${owner}/${repo}/git/refs`, {
      ref: `refs/heads/${branch}`,
      sha: commit.sha,
    });
  }
  console.log(`✅ 推送完成: ${branch} @ ${commit.sha.slice(0, 8)}`);
}

main().catch((e) => {
  console.error('\n❌ 失败:', e.message);
  process.exit(1);
});
