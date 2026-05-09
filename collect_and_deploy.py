#!/usr/bin/env python3
"""明星数据采集 → 更新data.json → git push → Vercel部署"""
import urllib.request, re, json, os, subprocess, time
from datetime import datetime, timezone, timedelta

BJ_TZ = timezone(timedelta(hours=8))
REPO = "/root/.openclaw/workspace/singclaw-stars"
DATA = os.path.join(REPO, "data.json")

SINA_TAGS = {
    "肖战": "https://tags.sina.com.cn/star_xiaozhan",
    "杨幂": "https://tags.sina.com.cn/%E6%9D%A8%E5%B9%82",
    "杨紫": "https://tags.sina.com.cn/%E6%9D%A8%E7%B4%AB",
    "王一博": "https://tags.sina.com.cn/%E7%8E%8B%E4%B8%80%E5%8D%9A",
    "刘亦菲": "https://tags.sina.com.cn/%E5%88%98%E4%BA%A6%E8%8F%B2",
    "易烊千玺": "https://tags.sina.com.cn/star_yiyangqianxi",
    "白鹿": "https://tags.sina.com.cn/%E7%99%BD%E9%B9%BF",
    "成毅": "https://tags.sina.com.cn/%E6%88%90%E6%AF%85",
    "赵露思": "https://tags.sina.com.cn/%E8%B5%B5%E9%9C%B2%E6%80%9D",
    "虞书欣": "https://tags.sina.com.cn/%E8%99%9E%E4%B9%A6%E6%AC%A3",
}

def fetch_one(name, url):
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        resp = urllib.request.urlopen(req, timeout=8)
        html = resp.read().decode("utf-8", errors="replace")
        body_start = html.find('</style>')
        if body_start < 0: return []
        body = html[body_start:]
        items = re.findall(r'class="news-title">(.*?)</div>', body, re.DOTALL)
        results = []
        for item in items[:5]:
            clean = re.sub(r'<[^>]+>', '', item).strip()
            lines = [l.strip() for l in clean.split('\n') if l.strip()]
            if lines:
                results.append({'title': lines[0][:100], 'content': ' '.join(lines[1:])[:300], 'platform': 'sina'})
        return results
    except:
        return []

def main():
    now = datetime.now(BJ_TZ).strftime('%Y-%m-%d %H:%M BJT')
    print(f"[{now}] 开始明星数据采集...")
    
    with open(DATA) as f:
        data = json.load(f)
    
    new_posts = []
    celeb_id_map = {c['name']: c['id'] for c in data['celebrities']}
    max_post_id = max(p['id'] for p in data['posts']) if data['posts'] else 0
    
    for name, url in SINA_TAGS.items():
        items = fetch_one(name, url)
        for item in items:
            if name in celeb_id_map:
                max_post_id += 1
                data['posts'].append({
                    'id': max_post_id, 'celebrity_id': celeb_id_map[name],
                    'platform': 'sina', 'post_id': '', 'title': item['title'],
                    'content': item['content'], 'url': '', 'images': '[]',
                    'likes': 0, 'comments': 0, 'shares': 0,
                    'collected_at': datetime.now(BJ_TZ).strftime('%Y-%m-%d %H:%M:%S'),
                    'posted_at': '', 'raw_data': '{}', 'celebrity_name': name,
                })
                new_posts.append({'name': name, 'title': item['title'][:50]})
        time.sleep(0.3)
    
    if not new_posts:
        print("无新数据，跳过部署")
        return
    
    # 更新stats
    data['stats']['posts'] = len(data['posts'])
    data['stats']['sina_posts'] = sum(1 for p in data['posts'] if p.get('platform') == 'sina')
    data['generated_at'] = datetime.now(BJ_TZ).isoformat()
    
    with open(DATA, 'w') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    
    print(f"新增 {len(new_posts)} 条帖子，总计 {len(data['posts'])} 条")
    
    # Git push
    os.chdir(REPO)
    subprocess.run(['git', 'add', '-A'], capture_output=True)
    subprocess.run(['git', 'commit', '-m', f'chore: 自动采集 {now}'], capture_output=True)
    result = subprocess.run(['git', 'push', 'origin', 'master'], capture_output=True, text=True, timeout=60)
    
    if result.returncode == 0:
        print("✅ 已推送 → Vercel自动部署")
        # 摘要
        names = set(p['name'] for p in new_posts)
        print(f"  采集明星: {', '.join(names)}")
        print(f"  站点: https://star.singclaw.xyz")
    else:
        print(f"⚠️ Push失败: {result.stderr[:200]}")

if __name__ == "__main__":
    main()
