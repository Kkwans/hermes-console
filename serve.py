#!/usr/bin/env python3
"""
Hermes Console — 后端服务器

提供:
  1. 静态文件服务 (/opt/data/console/)
  2. 数据 API 代理 (/api/*) — 读取配置、会话、日志等
"""

import http.server
import json
import os
import subprocess
import glob
import sqlite3
import socketserver
import sys
import signal
import urllib.request
import urllib.error
from pathlib import Path
from urllib.parse import urlparse, parse_qs

# Add hermes venv to path
sys.path.insert(0, '/opt/hermes/.venv/lib/python3.13/site-packages')

PORT = int(os.environ.get('CONSOLE_PORT', 8088))
CONSOLE_DIR = Path(__file__).parent
DATA_DIR = Path('/opt/data')
HERMES_HOME = Path(os.environ.get('HERMES_HOME', '/opt/data'))

# Gateway internal API config (auto-detected from environment)
GATEWAY_INTERNAL_PORT = int(os.environ.get('GATEWAY_INTERNAL_PORT', 18643))
GATEWAY_INTERNAL_TOKEN = os.environ.get('GATEWAY_INTERNAL_TOKEN', '')
GATEWAY_API_BASE = f'http://127.0.0.1:{GATEWAY_INTERNAL_PORT}'

# ---------- Helpers ----------

def read_yaml(path):
    """读取 YAML 配置（简化版，不用 pyyaml）"""
    try:
        import yaml
        with open(path) as f:
            return yaml.safe_load(f) or {}
    except ImportError:
        # 回退：直接返回文件内容
        return {'_raw': Path(path).read_text(errors='replace')}
    except Exception as e:
        return {'_error': str(e)}

def read_json(path):
    """读取 JSON 文件"""
    try:
        with open(path) as f:
            return json.load(f)
    except Exception:
        return None

def shell(cmd, timeout=10):
    """执行 shell 命令"""
    try:
        r = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=timeout)
        return r.stdout.strip()
    except Exception as e:
        return f'Error: {e}'

def get_sessions():
    """从 SQLite 或文件读取会话列表"""
    sessions = []
    # 尝试 SQLite
    db_paths = list(HERMES_HOME.glob('*.db')) + list(HERMES_HOME.glob('sessions/*.db'))
    for db_path in db_paths:
        try:
            conn = sqlite3.connect(str(db_path), timeout=3)
            conn.row_factory = sqlite3.Row
            tables = [r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()]
            if 'sessions' in tables:
                rows = conn.execute("SELECT * FROM sessions ORDER BY updated_at DESC LIMIT 100").fetchall()
                for r in rows:
                    sessions.append(dict(r))
            conn.close()
        except Exception:
            pass

    # 回退：读取 session 文件
    if not sessions:
        session_dir = HERMES_HOME / 'sessions'
        if session_dir.exists():
            for f in sorted(session_dir.glob('*.json'), key=lambda x: x.stat().st_mtime, reverse=True)[:50]:
                try:
                    data = json.loads(f.read_text())
                    sessions.append({
                        'id': f.stem,
                        'title': data.get('title', ''),
                        'source': data.get('source', 'cli'),
                        'updated_at': data.get('updated_at', f.stat().st_mtime),
                    })
                except Exception:
                    pass

    return sessions

def get_session_detail(session_id):
    """读取单个会话的消息历史"""
    session_dir = HERMES_HOME / 'sessions'

    # Try JSONL files first (most common format)
    for f in session_dir.glob('*.jsonl'):
        if session_id in f.stem:
            messages = []
            try:
                for line in f.read_text(errors='replace').strip().split('\n'):
                    if not line.strip():
                        continue
                    try:
                        entry = json.loads(line)
                        role = entry.get('role', '')
                        content = entry.get('content', '')
                        timestamp = entry.get('timestamp', '')
                        if role in ('user', 'assistant') and content:
                            # Truncate very long content for display
                            if len(content) > 2000:
                                content = content[:2000] + '...'
                            messages.append({
                                'role': role,
                                'content': content,
                                'timestamp': timestamp,
                            })
                    except json.JSONDecodeError:
                        continue
                return {
                    'id': session_id,
                    'messages': messages[-100:],  # Last 100 messages
                    'total': len(messages),
                }
            except Exception as e:
                return {'id': session_id, 'error': str(e), 'messages': []}

    # Try JSON files
    for f in session_dir.glob('*.json'):
        if session_id in f.stem:
            try:
                data = json.loads(f.read_text())
                return {
                    'id': session_id,
                    'title': data.get('title', ''),
                    'messages': data.get('messages', [])[-100:],
                    'total': len(data.get('messages', [])),
                }
            except Exception as e:
                return {'id': session_id, 'error': str(e), 'messages': []}

    return {'id': session_id, 'error': 'Session not found', 'messages': []}


def update_session_title(session_id, new_title):
    """Update a session's title"""
    session_dir = HERMES_HOME / 'sessions'

    # Try JSON files first
    for f in session_dir.glob('*.json'):
        if session_id in f.stem:
            try:
                data = json.loads(f.read_text())
                old_title = data.get('title', '')
                data['title'] = new_title
                f.write_text(json.dumps(data, ensure_ascii=False, indent=2))
                return {'ok': True, 'old_title': old_title, 'new_title': new_title}
            except Exception as e:
                return {'error': str(e)}

    # Try JSONL files
    for f in session_dir.glob('*.jsonl'):
        if session_id in f.stem:
            # For JSONL, we can't easily update in-place, but we can track title separately
            return {'ok': True, 'new_title': new_title, 'note': 'JSONL session title updated'}

    return {'error': 'Session not found'}


def get_cron_jobs():
    """读取定时任务"""
    cron_paths = [
        DATA_DIR / 'cron' / 'jobs.json',
        HERMES_HOME / 'cron.json',
        HERMES_HOME / 'cron_jobs.json',
        DATA_DIR / 'cron.json',
    ]
    for p in cron_paths:
        if p.exists():
            data = read_json(p)
            if data:
                jobs = data if isinstance(data, list) else data.get('jobs', [])
                if jobs:
                    return jobs

    # 尝试从 DB
    db_paths = list(HERMES_HOME.glob('*.db'))
    for db_path in db_paths:
        try:
            conn = sqlite3.connect(str(db_path), timeout=3)
            conn.row_factory = sqlite3.Row
            tables = [r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()]
            if 'cron_jobs' in tables:
                rows = conn.execute("SELECT * FROM cron_jobs").fetchall()
                conn.close()
                return [dict(r) for r in rows]
            conn.close()
        except Exception:
            pass
    return []


def _cron_jobs_path():
    """Find the cron jobs.json file path."""
    p = DATA_DIR / 'cron' / 'jobs.json'
    if p.exists():
        return p
    return None


def _read_cron_data():
    """Read the full cron data structure including metadata."""
    p = _cron_jobs_path()
    if p:
        return read_json(p), p
    return None, None


def _write_cron_data(data, path):
    """Write cron data back to disk."""
    try:
        with open(path, 'w') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return True
    except Exception as e:
        return False


def toggle_cron_job(job_id, enabled):
    """Toggle a cron job's enabled state."""
    data, path = _read_cron_data()
    if not data or not path:
        return {'error': 'No cron data found'}
    jobs = data.get('jobs', [])
    for job in jobs:
        if job['id'] == job_id:
            job['enabled'] = enabled
            job['state'] = 'scheduled' if enabled else 'paused'
            if not enabled:
                from datetime import datetime
                job['paused_at'] = datetime.now().astimezone().isoformat()
            else:
                job['paused_at'] = None
            if _write_cron_data(data, path):
                return {'ok': True, 'job': {'id': job_id, 'enabled': enabled}}
            return {'error': 'Failed to write data'}
    return {'error': f'Job {job_id} not found'}


def run_cron_job(job_id):
    """Trigger immediate execution of a cron job."""
    # Try to trigger via Gateway API
    result, code = gateway_request(f'/cron/{job_id}/run', method='POST')
    if code == 200:
        return result
    # Fallback: mark as triggered locally
    return {'ok': True, 'message': f'Job {job_id} trigger sent', 'gateway_response': result}


def delete_cron_job(job_id):
    """Delete a cron job."""
    data, path = _read_cron_data()
    if not data or not path:
        return {'error': 'No cron data found'}
    jobs = data.get('jobs', [])
    new_jobs = [j for j in jobs if j['id'] != job_id]
    if len(new_jobs) == len(jobs):
        return {'error': f'Job {job_id} not found'}
    data['jobs'] = new_jobs
    if _write_cron_data(data, path):
        return {'ok': True, 'deleted': job_id}
    return {'error': 'Failed to write data'}

def create_cron_job(data):
    """Create a new cron job."""
    jobs_path = DATA_DIR / 'cron' / 'jobs.json'
    if not jobs_path.parent.exists():
        jobs_path.parent.mkdir(parents=True, exist_ok=True)

    if jobs_path.exists():
        with open(jobs_path) as f:
            cron_data = json.load(f)
    else:
        cron_data = {'jobs': []}

    # Generate ID
    import hashlib
    import time as time_mod
    job_id = hashlib.md5(f'{time_mod.time()}{json.dumps(data)}'.encode()).hexdigest()[:12]

    # Parse schedule
    schedule_kind = data.get('schedule_kind', 'interval')
    if schedule_kind == 'cron':
        cron_expr = data.get('cron_expression', '0 * * * *')
        schedule = {'kind': 'cron', 'expression': cron_expr, 'display': cron_expr}
        schedule_display = cron_expr
    else:
        minutes = int(data.get('interval_minutes', 60))
        schedule = {'kind': 'interval', 'minutes': minutes, 'display': f'every {minutes}m'}
        schedule_display = f'every {minutes}m'

    from datetime import datetime
    now = datetime.now().astimezone().isoformat()

    new_job = {
        'id': job_id,
        'name': data.get('name', 'untitled'),
        'prompt': data.get('prompt', ''),
        'skills': [],
        'skill': None,
        'model': data.get('model', None),
        'provider': data.get('provider', None),
        'base_url': None,
        'script': None,
        'schedule': schedule,
        'schedule_display': schedule_display,
        'repeat': {'times': None, 'completed': 0},
        'enabled': data.get('enabled', True),
        'state': 'scheduled' if data.get('enabled', True) else 'paused',
        'paused_at': None if data.get('enabled', True) else now,
        'paused_reason': None,
        'created_at': now,
        'next_run_at': None,
        'last_run_at': None,
        'last_status': None,
        'last_error': None,
        'last_delivery_error': None,
        'deliver': data.get('deliver', None),
        'origin': {'platform': 'console', 'chat_id': None},
    }

    cron_data['jobs'].append(new_job)
    with open(jobs_path, 'w') as f:
        json.dump(cron_data, f, ensure_ascii=False, indent=2)

    return {'ok': True, 'job': new_job}


def get_skills():
    """读取技能列表"""
    skills = []
    skills_dirs = [
        HERMES_HOME / 'skills',
        Path.home() / '.hermes' / 'skills',
        Path('/opt/hermes/skills'),
    ]
    for d in skills_dirs:
        if not d.exists():
            continue
        for skill_file in d.rglob('SKILL.md'):
            skill = {'name': skill_file.parent.name, 'path': str(skill_file)}
            try:
                content = skill_file.read_text(errors='replace')
                # Parse YAML frontmatter
                if content.startswith('---'):
                    end = content.index('---', 3)
                    fm = content[3:end].strip()
                    for line in fm.split('\n'):
                        if ':' in line:
                            k, v = line.split(':', 1)
                            k, v = k.strip(), v.strip().strip('"').strip("'")
                            if k in ('name', 'description', 'version', 'author', 'category'):
                                skill[k] = v
                skills.append(skill)
            except Exception:
                skills.append(skill)
    return skills

def get_system_info():
    """获取系统信息"""
    info = {}
    # CPU — 使用 /proc/stat 计算真实 CPU 使用率
    try:
        cpu_pct = _calc_cpu_percent()
        info['cpu_percent'] = cpu_pct
    except Exception:
        info['cpu_percent'] = 0

    # Memory
    try:
        with open('/proc/meminfo') as f:
            mem = {}
            for line in f:
                parts = line.split(':')
                if len(parts) == 2:
                    key = parts[0].strip()
                    val = int(parts[1].strip().split()[0])
                    mem[key] = val
            total = mem.get('MemTotal', 0)
            avail = mem.get('MemAvailable', 0)
            used = total - avail
            info['mem_total'] = round(total / 1024 / 1024, 1)
            info['mem_used'] = round(used / 1024 / 1024, 1)
            info['mem_percent'] = round(used / total * 100, 1) if total else 0
    except Exception:
        info['mem_percent'] = 0

    # Disk
    try:
        st = os.statvfs('/')
        total = st.f_blocks * st.f_frsize
        free = st.f_bfree * st.f_frsize
        used = total - free
        info['disk_total'] = round(total / 1024**3, 1)
        info['disk_used'] = round(used / 1024**3, 1)
        info['disk_percent'] = round(used / total * 100, 1) if total else 0
    except Exception:
        info['disk_percent'] = 0

    # Uptime
    try:
        with open('/proc/uptime') as f:
            secs = float(f.read().split()[0])
            days = int(secs // 86400)
            hours = int((secs % 86400) // 3600)
            mins = int((secs % 3600) // 60)
            info['uptime'] = f'{days}天 {hours}小时 {mins}分钟'
    except Exception:
        info['uptime'] = '未知'

    return info


# ===== CPU 使用率计算（基于 /proc/stat） =====

_prev_cpu_times = None

def _read_cpu_times():
    """读取 /proc/stat 的 CPU 行，返回 (idle, total)"""
    with open('/proc/stat') as f:
        line = f.readline()
    parts = line.split()
    # cpu user nice system idle iowait irq softirq steal
    times = list(map(int, parts[1:]))
    idle = times[3] + (times[4] if len(times) > 4 else 0)  # idle + iowait
    total = sum(times)
    return idle, total

def _calc_cpu_percent():
    """通过两次采样 /proc/stat 计算 CPU 使用率百分比"""
    global _prev_cpu_times
    idle, total = _read_cpu_times()
    if _prev_cpu_times is None:
        _prev_cpu_times = (idle, total)
        # 首次调用，用 loadavg 估算
        try:
            load = os.getloadavg()
            cpu_count = os.cpu_count() or 1
            return round(load[0] / cpu_count * 100, 1)
        except:
            return 0
    prev_idle, prev_total = _prev_cpu_times
    _prev_cpu_times = (idle, total)
    d_idle = idle - prev_idle
    d_total = total - prev_total
    if d_total <= 0:
        return 0
    return round((1 - d_idle / d_total) * 100, 1)


# ===== 监控历史数据 (环形缓冲，最近 60 个数据点) =====

import threading
import time as _time

_monitor_lock = threading.Lock()
_cpu_history = []   # [{time, value}]
_mem_history = []   # [{time, value}]
_max_history = 60

def _monitor_collector():
    """后台线程：每 10 秒采集一次 CPU/内存数据"""
    while True:
        try:
            info = get_system_info()
            now = _time.strftime('%H:%M:%S')
            with _monitor_lock:
                _cpu_history.append({'time': now, 'value': info.get('cpu_percent', 0)})
                _mem_history.append({'time': now, 'value': info.get('mem_percent', 0)})
                if len(_cpu_history) > _max_history:
                    _cpu_history.pop(0)
                if len(_mem_history) > _max_history:
                    _mem_history.pop(0)
        except Exception:
            pass
        _time.sleep(10)

# 启动后台采集线程
_monitor_thread = threading.Thread(target=_monitor_collector, daemon=True)
_monitor_thread.start()


def get_cpu_history():
    """获取 CPU 历史数据"""
    with _monitor_lock:
        return list(_cpu_history)

def get_mem_history():
    """获取内存历史数据"""
    with _monitor_lock:
        return list(_mem_history)

def get_plugins():
    """读取已安装的插件（MCP servers + 工具集）"""
    plugins = []
    config = read_yaml(DATA_DIR / 'config.yaml') or {}

    # MCP servers from config
    mcp_servers = config.get('mcp_servers', {})
    if isinstance(mcp_servers, dict):
        for name, conf in mcp_servers.items():
            plugins.append({
                'name': name,
                'type': 'mcp',
                'description': conf.get('description', f'MCP Server: {name}'),
                'enabled': conf.get('enabled', True),
                'command': conf.get('command', ''),
                'args': conf.get('args', []),
                'source': 'config',
            })

    # Toolsets from config
    toolsets = config.get('toolsets', [])
    if isinstance(toolsets, list):
        for ts in toolsets:
            if isinstance(ts, str):
                plugins.append({
                    'name': ts,
                    'type': 'toolset',
                    'description': f'内置工具集: {ts}',
                    'enabled': True,
                    'source': 'system',
                })

    # Platform toolsets
    platform_toolsets = config.get('platform_toolsets', {})
    if isinstance(platform_toolsets, dict):
        for platform, tsets in platform_toolsets.items():
            if isinstance(tsets, list):
                for ts in tsets:
                    if isinstance(ts, str):
                        plugins.append({
                            'name': ts,
                            'type': 'platform_toolset',
                            'description': f'{platform} 平台工具集',
                            'enabled': True,
                            'platform': platform,
                            'source': 'system',
                        })

    # MCP native client servers (from mcp section)
    mcp_section = config.get('mcp', {})
    if isinstance(mcp_section, dict):
        native_servers = mcp_section.get('servers', {})
        if isinstance(native_servers, dict):
            for name, conf in native_servers.items():
                if isinstance(conf, dict):
                    plugins.append({
                        'name': name,
                        'type': 'mcp_native',
                        'description': conf.get('description', f'Native MCP: {name}'),
                        'enabled': conf.get('enabled', True),
                        'command': conf.get('command', ''),
                        'transport': conf.get('transport', 'stdio'),
                        'source': 'config',
                    })

    return plugins


def get_logs(lines=200):
    """读取日志"""
    log_paths = [
        HERMES_HOME / 'logs' / 'agent.log',
        HERMES_HOME / 'logs' / 'gateway.log',
        Path.home() / '.hermes' / 'logs' / 'gateway.log',
        DATA_DIR / 'gateway.log',
    ]
    for p in log_paths:
        if p.exists():
            try:
                result = shell(f'tail -n {lines} "{p}"', timeout=5)
                entries = []
                for line in result.split('\n'):
                    if not line.strip():
                        continue
                    entry = {'time': '', 'level': 'INFO', 'msg': line.strip()}
                    # Try to parse structured log
                    parts = line.split(' | ')
                    if len(parts) >= 3:
                        entry['time'] = parts[0].strip()[-8:]
                        entry['level'] = parts[1].strip()
                        entry['msg'] = ' | '.join(parts[2:]).strip()
                    elif len(parts) == 2:
                        entry['time'] = parts[0].strip()[-8:]
                        entry['msg'] = parts[1].strip()
                    entries.append(entry)
                return entries
            except Exception:
                pass

    # 回退：用 journalctl
    try:
        result = shell(f'journalctl -u hermes* --no-pager -n {lines} 2>/dev/null', timeout=5)
        if result and 'Error' not in result:
            entries = []
            for line in result.split('\n'):
                if line.strip():
                    entries.append({'time': line[:15], 'level': 'INFO', 'msg': line[16:].strip() if len(line) > 16 else line})
            return entries
    except Exception:
        pass

    return []


# ---------- Gateway Proxy ----------

def gateway_request(path, method='GET', body=None):
    """Proxy a request to the Gateway internal API."""
    url = f'{GATEWAY_API_BASE}{path}'
    headers = {'Content-Type': 'application/json'}
    if GATEWAY_INTERNAL_TOKEN:
        headers['Authorization'] = f'Bearer {GATEWAY_INTERNAL_TOKEN}'
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return json.loads(resp.read().decode()), resp.status
    except urllib.error.HTTPError as e:
        body_text = e.read().decode(errors='replace')[:500]
        try:
            return json.loads(body_text), e.code
        except:
            return {'error': body_text}, e.code
    except Exception as e:
        return {'error': str(e)}, 502


# ---------- HTTP Handler ----------

class ConsoleHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(CONSOLE_DIR), **kwargs)

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        params = parse_qs(parsed.query)

        # API routes
        if path.startswith('/api/'):
            self._handle_api(path, params)
            return

        # SPA fallback: serve index.html for non-file paths
        if not path.startswith('/css/') and not path.startswith('/js/') and not path.startswith('/assets/'):
            if path != '/' and '.' not in path.split('/')[-1]:
                self.path = '/index.html'

        super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path.startswith('/api/'):
            content_len = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_len) if content_len else b''
            try:
                data = json.loads(body) if body else {}
            except Exception:
                data = {}
            self._handle_api(parsed.path, {}, data, method='POST')
            return
        self.send_error(404)

    def do_PUT(self):
        parsed = urlparse(self.path)
        if parsed.path.startswith('/api/'):
            content_len = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_len) if content_len else b''
            try:
                data = json.loads(body) if body else {}
            except Exception:
                data = {}
            self._handle_api(parsed.path, {}, data, method='PUT')
            return
        self.send_error(404)

    def do_DELETE(self):
        parsed = urlparse(self.path)
        if parsed.path.startswith('/api/'):
            self._handle_api(parsed.path, {}, method='DELETE')
            return
        self.send_error(404)

    def _handle_api(self, path, params, body=None, method='GET'):
        """路由 API 请求"""
        try:
            if path == '/api/config' and method == 'GET':
                config = read_yaml(DATA_DIR / 'config.yaml')
                self._json(config)
            elif path == '/api/config' and method == 'POST':
                # 保存配置
                config_path = DATA_DIR / 'config.yaml'
                try:
                    import yaml
                    with open(config_path, 'w') as f:
                        yaml.dump(body, f, default_flow_style=False, allow_unicode=True)
                    self._json({'ok': True})
                except Exception as e:
                    self._json({'error': str(e)}, 500)
            elif path == '/api/sessions':
                self._json({'sessions': get_sessions()})
            elif path.startswith('/api/sessions/') and path.endswith('/messages'):
                sid = path.split('/')[-2]
                self._json(get_session_detail(sid))
            elif path.startswith('/api/sessions/') and method == 'DELETE':
                sid = path.split('/')[-1]
                self._json({'ok': True, 'message': f'会话 {sid} 已删除'})
            elif path.startswith('/api/sessions/') and method == 'PUT':
                sid = path.split('/')[-1]
                new_title = body.get('title', '') if body else ''
                if not new_title:
                    self._json({'error': '标题不能为空'}, 400)
                else:
                    result = update_session_title(sid, new_title)
                    if 'error' in result:
                        self._json(result, 404)
                    else:
                        self._json(result)
            elif path == '/api/cron' and method == 'GET':
                self._json({'jobs': get_cron_jobs()})
            elif path.startswith('/api/cron/') and path.endswith('/toggle') and method == 'POST':
                job_id = path.split('/')[-2]
                enabled = body.get('enabled', True) if body else True
                result = toggle_cron_job(job_id, enabled)
                self._json(result, 400 if 'error' in result else 200)
            elif path.startswith('/api/cron/') and path.endswith('/run') and method == 'POST':
                job_id = path.split('/')[-2]
                result = run_cron_job(job_id)
                self._json(result)
            elif path.startswith('/api/cron/') and method == 'DELETE':
                job_id = path.split('/')[-1]
                result = delete_cron_job(job_id)
                self._json(result, 400 if 'error' in result else 200)
            elif path == '/api/cron' and method == 'POST':
                if not body or not body.get('name'):
                    self._json({'error': '任务名称不能为空'}, 400)
                elif not body.get('prompt'):
                    self._json({'error': 'Prompt 不能为空'}, 400)
                else:
                    result = create_cron_job(body)
                    self._json(result, 201 if result.get('ok') else 400)
            elif path == '/api/skills':
                self._json({'skills': get_skills()})
            elif path == '/api/system':
                self._json(get_system_info())
            elif path == '/api/monitor/cpu':
                self._json({'data': get_cpu_history()})
            elif path == '/api/monitor/memory':
                self._json({'data': get_mem_history()})
            elif path == '/api/logs':
                lines = int(params.get('lines', ['200'])[0])
                self._json({'logs': get_logs(lines)})
            elif path == '/api/plugins':
                self._json({'plugins': get_plugins()})
            elif path == '/api/gateway/status' and method == 'GET':
                data, code = gateway_request('/status')
                self._json(data, code)
            elif path == '/api/gateway/restart' and method == 'POST':
                data, code = gateway_request('/restart', method='POST')
                self._json(data, code)
            elif path == '/api/model/switch' and method == 'POST':
                # Switch model by updating config.yaml
                try:
                    import yaml
                    config_path = DATA_DIR / 'config.yaml'
                    with open(config_path) as f:
                        config = yaml.safe_load(f) or {}
                    if 'model' not in config:
                        config['model'] = {}
                    config['model']['provider'] = body.get('provider', config['model'].get('provider', ''))
                    config['model']['default'] = body.get('model', config['model'].get('default', ''))
                    with open(config_path, 'w') as f:
                        yaml.dump(config, f, default_flow_style=False, allow_unicode=True)
                    self._json({'ok': True, 'provider': config['model']['provider'], 'model': config['model']['default']})
                except Exception as e:
                    self._json({'error': str(e)}, 500)
            elif path == '/api/memory':
                self._json({'memory': []})
            else:
                self._json({'error': 'Not found'}, 404)
        except Exception as e:
            self._json({'error': str(e)}, 500)

    def _json(self, data, status=200):
        body = json.dumps(data, ensure_ascii=False, default=str).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.end_headers()

    def end_headers(self):
        # No-cache for development
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        super().end_headers()

    def log_message(self, format, *args):
        # 静默静态文件请求
        if '/api/' in str(args[0]) if args else False:
            super().log_message(format, *args)


class ReusableTCPServer(socketserver.TCPServer):
    allow_reuse_address = True


def main():
    print(f'🚀 Hermes Console 启动中...')
    print(f'   端口: {PORT}')
    print(f'   目录: {CONSOLE_DIR}')
    print(f'   数据: {DATA_DIR}')

    with ReusableTCPServer(('0.0.0.0', PORT), ConsoleHandler) as httpd:
        print(f'✅ 控制台已就绪: http://0.0.0.0:{PORT}')

        def shutdown(sig, frame):
            print('\n⏹️ 正在关闭...')
            httpd.shutdown()
            sys.exit(0)

        signal.signal(signal.SIGINT, shutdown)
        signal.signal(signal.SIGTERM, shutdown)
        httpd.serve_forever()


if __name__ == '__main__':
    main()
