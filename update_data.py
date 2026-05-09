#!/usr/bin/env python3
"""
明星追踪数据管线 - 采集 → 灌入 star.singclaw.xyz → 推送到Vercel
"""
import json, os, subprocess
from datetime import datetime, timezone, timedelta

BJ_TZ = timezone(timedelta(hours=8))
STARS_REPO = "/root/.openclaw/workspace/singclaw-stars"
DATA_FILE = os.path.join(STARS_REPO, "data.json")
NOW_STR = datetime.now(BJ_TZ).strftime('%Y-%m-%d %H:%M BJT')

def main():
    # Step 1: 检查当前数据
    if not os.path.exists(DATA_FILE):
        print(f"⚠️ 数据文件不存在: {DATA_FILE}")
        return
    
    with open(DATA_FILE) as f:
        data = json.load(f)
    
    print(f"[{NOW_STR}] 明星数据管线")
    print(f"  记录数: {len(data)}")
    
    # Step 2: 更新数据文件时间戳
    # (未来可扩展：这里可以加入新的采集逻辑)
    
    # Step 3: git push → 触发Vercel自动部署
    os.chdir(STARS_REPO)
    
    # 检查是否有变更
    result = subprocess.run(['git', 'status', '--porcelain'], capture_output=True, text=True)
    if not result.stdout.strip():
        print("  ✅ 无变更，跳过部署")
        return
    
    subprocess.run(['git', 'add', '-A'])
    subprocess.run(['git', 'commit', '-m', f'chore: 数据更新 {NOW_STR}'])
    result = subprocess.run(['git', 'push', 'origin', 'master'], capture_output=True, text=True, timeout=60)
    
    if result.returncode == 0:
        print("  ✅ 已推送 → Vercel自动部署 star.singclaw.xyz")
    else:
        print(f"  ⚠️ Push失败: {result.stderr[:200]}")

if __name__ == "__main__":
    main()
