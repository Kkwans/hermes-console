/**
 * app.js — Hermes 控制台 Vue 3 应用
 */

const { createApp, ref, computed, onMounted, watch, nextTick } = Vue;

const app = createApp({
  setup() {
    // ===== State =====
    const sidebarCollapsed = ref(Utils.store.get('sidebar_collapsed', false));
    const mobileMenuOpen = ref(false);
    const currentPage = ref(Utils.store.get('current_page', 'dashboard'));
    const gatewayRunning = ref(false);
    const gatewayAdapters = ref([]);
    const toasts = ref([]);

    // Theme
    const isDarkTheme = ref(Utils.store.get('theme', 'light') === 'dark');

    // Dashboard
    const dashboardStats = ref([]);
    const configModels = ref([]);
    const recentLogs = ref([]);
    const cpuData = ref([]);
    const memData = ref([]);

    // Sessions
    const sessions = ref([]);
    const sessionSearch = ref('');
    const selectedSession = ref(null);
    const sessionMessages = ref([]);
    const sessionLoading = ref(false);
    const sessionTotal = ref(0);
    const sessionDetailTitle = ref("");
    const sessionPage = ref(1);
    const sessionPageSize = 20;

    // Session editing
    const editingSessionId = ref(null);
    const editingSessionTitle = ref('');

    // Cron
    const cronJobs = ref([]);

    // Cron form (create/edit)
    const showCronForm = ref(false);
    const cronFormMode = ref('create');  // 'create' or 'edit'
    const cronFormSubmitting = ref(false);
    const cronForm = ref({
      name: '',
      schedule_kind: 'interval',
      interval_minutes: 60,
      cron_expression: '0 * * * *',
      prompt: '',
      enabled: true,
      deliver: '',
    });

    // Skills
    const skills = ref([]);
    const skillSearch = ref('');
    const skillCategoryFilter = ref('');
    const selectedSkill = ref(null);

    // Config
    const appConfig = ref({});
    const editableConfig = ref({ agent: {}, display: {} });
    const switchForm = ref({ provider: '', model: '' });
    const switchResult = ref(null);
    const customModelName = ref('');

    // Provider form
    const showProviderForm = ref(false);
    const providerFormMode = ref('create');
    const providerForm = ref({ name: '', base_url: '', api_key: '' });

    // Known models per provider
    const knownModels = {
      mimo: ['mimo-v2.5-pro', 'mimo-v2.5-flash', 'mimo-v2-pro', 'mimo-v2-flash'],
      'minimax-cn': ['abab7-chat', 'abab6.5s-chat', 'abab6.5-chat', 'abab5.5-chat'],
      openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo', 'o1-preview', 'o1-mini', 'o3-mini'],
      anthropic: ['claude-sonnet-4-20250514', 'claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229'],
      deepseek: ['deepseek-chat', 'deepseek-reasoner', 'deepseek-coder'],
      google: ['gemini-2.0-flash', 'gemini-2.0-pro', 'gemini-1.5-pro', 'gemini-1.5-flash'],
      qwen: ['qwen-max', 'qwen-plus', 'qwen-turbo', 'qwen-long'],
    };

    // Known provider URLs for hints
    const providerUrlHints = {
      openai: 'https://api.openai.com/v1',
      anthropic: 'https://api.anthropic.com',
      deepseek: 'https://api.deepseek.com',
      google: 'https://generativelanguage.googleapis.com/v1beta',
      qwen: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      mimo: 'https://api.xiaomi.com/v1',
      'minimax-cn': 'https://api.minimax.chat/v1',
    };

    // Logs
    const logEntries = ref([]);
    const logLevel = ref('');
    const logSearch = ref('');
    const autoScroll = ref(true);
    const autoRefresh = ref(true);
    let logRefreshTimer = null;

    // Monitor
    const systemInfo = ref({});
    const monitorCpuData = ref([]);
    const monitorMemData = ref([]);

    // Plugins
    const plugins = ref([]);
    const pluginSearch = ref('');
    const pluginTypeFilter = ref('');
    const selectedPlugin = ref(null);

    // Confirm dialog
    const showConfirm = ref(false);
    const confirmIcon = ref('⚠️');
    const confirmTitle = ref('');
    const confirmMsg = ref('');
    let confirmAction = () => {};

    // Token setup
    const showTokenSetup = ref(false);
    const tokenInput = ref('');
    const tokenSaving = ref(false);

    // Chart refs (template refs)
    const cpuChartEl = ref(null);
    const memChartEl = ref(null);
    const monitorChartEl = ref(null);
    const logViewer = ref(null);

    // ECharts instances (not reactive)
    let cpuChartInst = null;
    let memChartInst = null;
    let monitorChartInst = null;

    // ===== Menu =====
    const menuItems = [
      { icon: '🏠', label: '仪表盘', path: 'dashboard' },
      { icon: '💬', label: '会话管理', path: 'sessions' },
      { icon: '⏰', label: '定时任务', path: 'cron' },
      { icon: '🧩', label: '技能管理', path: 'skills' },
      { icon: '🔌', label: '插件管理', path: 'plugins' },
      { icon: '🤖', label: '模型配置', path: 'models' },
      { icon: '📡', label: '消息渠道', path: 'channels' },
      { icon: '⚙️', label: '系统设置', path: 'settings' },
      { icon: '📊', label: '系统监控', path: 'monitor' },
      { icon: '📝', label: '日志查看', path: 'logs' },
    ];

    const pageTitleMap = {
      dashboard: '仪表盘',
      sessions: '会话管理',
      cron: '定时任务',
      skills: '技能管理',
      plugins: '插件管理',
      models: '模型配置',
      channels: '消息渠道',
      settings: '系统设置',
      monitor: '系统监控',
      logs: '日志查看',
    };

    const currentPageTitle = computed(() => pageTitleMap[currentPage.value] || '未知页面');

    // 官方控制台地址
    const officialConsoleUrl = computed(() => {
      return 'http://192.168.5.110:19119/login';
    });

    // ===== Toast =====
    function toast(msg, type = 'info') {
      toasts.value.push({ msg, type });
      setTimeout(() => { toasts.value.shift(); }, 3000);
    }

    // ===== Navigation =====
    function navigate(page) {
      currentPage.value = page;
      Utils.store.set('current_page', page);
      window.location.hash = '#/' + page;
      nextTick(() => onPageLoad(page));
    }

    // ===== Theme =====
    function applyTheme(dark) {
      document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
      // Update ECharts theme
      const textColor = dark ? '#a1a1a1' : '#666666';
      const splitColor = dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
      const tooltipBg = dark ? '#171717' : '#ffffff';
      const tooltipBorder = dark ? '#2a2a2a' : '#ebebeb';
      const tooltipText = dark ? '#ededed' : '#171717';
      [cpuChartInst, memChartInst, monitorChartInst].forEach(c => {
        if (!c) return;
        c.setOption({
          xAxis: { axisLabel: { color: textColor } },
          yAxis: { axisLabel: { color: textColor }, splitLine: { lineStyle: { color: splitColor } } },
          tooltip: { backgroundColor: tooltipBg, borderColor: tooltipBorder, textStyle: { color: tooltipText } },
          legend: { textStyle: { color: textColor } },
        });
      });
    }

    function toggleTheme() {
      isDarkTheme.value = !isDarkTheme.value;
      Utils.store.set('theme', isDarkTheme.value ? 'dark' : 'light');
      applyTheme(isDarkTheme.value);
    }

    // ===== Data Loading =====
    async function loadGatewayStatus() {
      try {
        const status = await HermesAPI.getStatus();
        gatewayRunning.value = status.running !== false;
        const adapters = [];
        for (const [name, info] of Object.entries(status.adapters || {})) {
          adapters.push({ name, connected: info.connected });
        }
        gatewayAdapters.value = adapters;
      } catch {
        try {
          await HermesAPI.proxy('/system');
          gatewayRunning.value = true;
        } catch {
          gatewayRunning.value = false;
        }
      }
    }

    async function loadConfig() {
      try {
        const config = await HermesAPI.getConfig();
        appConfig.value = config;
        editableConfig.value = {
          agent: { ...(config.agent || {}) },
          display: { ...(config.display || {}) },
          approvals: { ...(config.approvals || {}) },
        };
        configModels.value = [];
        if (config.model?.default) configModels.value.push(config.model.default);
        if (config.model?.provider) configModels.value.push(`[${config.model.provider}]`);
      } catch (err) {
        console.error('加载配置失败:', err);
      }
    }

    async function switchModel() {
      switchResult.value = null;
      const provider = switchForm.value.provider;
      let model = switchForm.value.model;
      if (model === '__custom__') {
        model = customModelName.value.trim();
        if (!model) {
          toast('请输入自定义模型名称', 'error');
          return;
        }
      }
      try {
        const result = await HermesAPI.switchModel(provider, model);
        if (result.ok) {
          switchResult.value = { ok: true };
          toast(`已切换到 ${model}`, 'success');
          await loadConfig(); // Refresh config
          switchForm.value = { provider: '', model: '' };
          customModelName.value = '';
        } else {
          switchResult.value = { ok: false, error: result.error || '切换失败' };
        }
      } catch (err) {
        switchResult.value = { ok: false, error: err.message };
      }
      setTimeout(() => switchResult.value = null, 3000);
    }

    async function loadSessions() {
      try {
        const data = await HermesAPI.getSessions();
        sessions.value = data.sessions || [];
      } catch (err) {
        console.error('加载会话失败:', err);
      }
    }

    async function deleteSession(id) {
      try {
        await HermesAPI.deleteSession(id);
        sessions.value = sessions.value.filter(s => s.id !== id);
        toast('会话已删除', 'success');
      } catch (err) {
        toast('删除失败: ' + err.message, 'error');
      }
    }

    function confirmDeleteSession(id, title) {
      const sessionTitle = title || '未命名会话';
      confirmIcon.value = '🗑️';
      confirmTitle.value = '删除会话';
      confirmMsg.value = `确认要删除会话「${sessionTitle}」吗？此操作不可撤销。`;
      confirmAction = () => deleteSession(id);
      showConfirm.value = true;
    }

    function startEditSession(session) {
      editingSessionId.value = session.id;
      editingSessionTitle.value = session.title || '';
      nextTick(() => {
        const input = document.querySelector('.editing-input');
        if (input) input.focus();
      });
    }

    function cancelEditSession() {
      editingSessionId.value = null;
      editingSessionTitle.value = '';
    }

    async function saveEditSession(id) {
      const newTitle = editingSessionTitle.value.trim();
      if (!newTitle) {
        toast('标题不能为空', 'error');
        return;
      }
      try {
        await HermesAPI.updateSession(id, newTitle);
        // Update local data
        const session = sessions.value.find(s => s.id === id);
        if (session) session.title = newTitle;
        toast('标题已更新', 'success');
        cancelEditSession();
      } catch (err) {
        toast('更新失败: ' + err.message, 'error');
      }
    }

    async function openSessionDetail(id) {
      selectedSession.value = id;
      sessionLoading.value = true;
      sessionMessages.value = [];
      try {
        const data = await HermesAPI.getSessionDetail(id);
        sessionMessages.value = data.messages || [];
        sessionTotal.value = data.total || 0;
        sessionDetailTitle.value = data.title || "";
      } catch (err) {
        console.error('加载会话详情失败:', err);
        toast('加载会话详情失败', 'error');
      } finally {
        sessionLoading.value = false;
      }
    }

    async function refreshSessionDetail() {
      if (selectedSession.value) {
        await openSessionDetail(selectedSession.value);
      }
    }

    async function loadCronJobs() {
      try {
        const data = await HermesAPI.getCronJobs();
        cronJobs.value = data.jobs || [];
      } catch (err) {
        console.error('加载定时任务失败:', err);
      }
    }

    async function toggleCron(job) {
      try {
        await HermesAPI.toggleCron(job.id, !job.enabled);
        job.enabled = !job.enabled;
        toast(job.enabled ? '任务已启用' : '任务已暂停', 'success');
      } catch (err) {
        toast('操作失败: ' + err.message, 'error');
      }
    }

    async function runCron(id) {
      try {
        await HermesAPI.runCron(id);
        toast('任务已触发执行', 'success');
      } catch (err) {
        toast('执行失败: ' + err.message, 'error');
      }
    }

    async function deleteCron(id) {
      try {
        await HermesAPI.deleteCron(id);
        cronJobs.value = cronJobs.value.filter(j => j.id !== id);
        toast('任务已删除', 'success');
      } catch (err) {
        toast('删除失败: ' + err.message, 'error');
      }
    }

    function confirmDeleteCron(job) {
      const jobName = job.name || job.id;
      confirmIcon.value = '🗑️';
      confirmTitle.value = '删除定时任务';
      confirmMsg.value = `确认要删除定时任务「${jobName}」吗？此操作不可撤销。`;
      confirmAction = () => deleteCron(job.id);
      showConfirm.value = true;
    }

    function openCronForm(mode = 'create', job = null) {
      cronFormMode.value = mode;
      if (mode === 'edit' && job) {
        cronForm.value = {
          id: job.id,
          name: job.name || '',
          schedule_kind: job.schedule?.kind || 'interval',
          interval_minutes: job.schedule?.minutes || 60,
          cron_expression: job.schedule?.expression || '0 * * * *',
          prompt: job.prompt || '',
          enabled: job.enabled !== false,
          deliver: job.deliver || '',
        };
      } else {
        cronForm.value = {
          name: '',
          schedule_kind: 'interval',
          interval_minutes: 60,
          cron_expression: '0 * * * *',
          prompt: '',
          enabled: true,
          deliver: '',
        };
      }
      showCronForm.value = true;
    }

    function resetCronForm() {
      showCronForm.value = false;
      cronFormSubmitting.value = false;
    }

    async function submitCronForm() {
      const form = cronForm.value;
      if (!form.name.trim()) {
        toast('请输入任务名称', 'error');
        return;
      }
      if (!form.prompt.trim()) {
        toast('请输入 Prompt 内容', 'error');
        return;
      }
      cronFormSubmitting.value = true;
      try {
        if (cronFormMode.value === 'edit' && form.id) {
          // Update via toggle + recreate (simple approach: delete old, create new)
          await HermesAPI.deleteCron(form.id);
        }
        const result = await HermesAPI.createCronJob({
          name: form.name,
          schedule_kind: form.schedule_kind,
          interval_minutes: parseInt(form.interval_minutes) || 60,
          cron_expression: form.cron_expression,
          prompt: form.prompt,
          enabled: form.enabled,
          deliver: form.deliver || undefined,
        });
        if (result.ok) {
          toast(cronFormMode.value === 'create' ? '定时任务已创建' : '定时任务已更新', 'success');
          resetCronForm();
          await loadCronJobs();
        } else {
          toast('操作失败: ' + (result.error || '未知错误'), 'error');
        }
      } catch (err) {
        toast('操作失败: ' + err.message, 'error');
      } finally {
        cronFormSubmitting.value = false;
      }
    }

    async function loadSkills() {
      try {
        const data = await HermesAPI.getSkills();
        skills.value = data.skills || [];
      } catch (err) {
        console.error('加载技能失败:', err);
      }
    }

    async function loadSystemInfo() {
      try {
        const info = await HermesAPI.getSystemInfo();
        systemInfo.value = info;
        // 从后端获取历史数据
        try {
          const cpuResp = await HermesAPI.getMonitorCpu();
          if (cpuResp.data && cpuResp.data.length > 0) {
            monitorCpuData.value = cpuResp.data;
          }
          const memResp = await HermesAPI.getMonitorMemory();
          if (memResp.data && memResp.data.length > 0) {
            monitorMemData.value = memResp.data;
          }
        } catch {
          // 回退：前端采集
          const now = new Date().toLocaleTimeString('zh-CN', { hour12: false });
          monitorCpuData.value.push({ time: now, value: info.cpu_percent || 0 });
          monitorMemData.value.push({ time: now, value: info.mem_percent || 0 });
          if (monitorCpuData.value.length > 60) monitorCpuData.value.shift();
          if (monitorMemData.value.length > 60) monitorMemData.value.shift();
        }
      } catch (err) {
        console.error('加载系统信息失败:', err);
      }
    }

    async function loadLogs() {
      try {
        const data = await HermesAPI.getLogs(200);
        logEntries.value = data.logs || [];
        recentLogs.value = (data.logs || []).slice(-20);
      } catch (err) {
        console.error('Failed to load logs:', err);
      }
    }

    function toggleAutoRefresh() {
      autoRefresh.value = !autoRefresh.value;
      if (autoRefresh.value) {
        startLogRefresh();
      } else {
        stopLogRefresh();
      }
      toast(autoRefresh.value ? '日志自动刷新已开启' : '日志自动刷新已关闭', 'info');
    }

    function startLogRefresh() {
      stopLogRefresh();
      logRefreshTimer = setInterval(() => {
        if (currentPage.value === 'logs') {
          loadLogs();
        }
      }, 5000);
    }

    function stopLogRefresh() {
      if (logRefreshTimer) {
        clearInterval(logRefreshTimer);
        logRefreshTimer = null;
      }
    }

    async function loadPlugins() {
      try {
        const data = await HermesAPI.getPlugins();
        plugins.value = data.plugins || [];
      } catch (err) {
        console.error('Failed to load plugins:', err);
      }
    }

    async function loadDashboardStats() {
      await Promise.all([loadGatewayStatus(), loadSystemInfo(), loadLogs()]);
      dashboardStats.value = [
        { icon: '⚡', label: 'Gateway 状态', value: gatewayRunning.value ? '运行中' : '已停止', iconBg: gatewayRunning.value ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)' },
        { icon: '💬', label: '活跃会话', value: sessions.value.length || '0', iconBg: 'rgba(82,82,82,0.08)' },
        { icon: '⏰', label: '定时任务', value: cronJobs.value.length || '0', iconBg: 'rgba(245,158,11,0.1)' },
        { icon: '🧩', label: '已安装技能', value: skills.value.length || '0', iconBg: 'rgba(128,128,128,0.1)' },
      ];
    }

    async function saveSettings() {
      try {
        await HermesAPI.updateConfig(editableConfig.value);
        toast('设置已保存', 'success');
        loadConfig();
      } catch (err) {
        toast('保存失败: ' + err.message, 'error');
      }
    }

    function refreshData() {
      toast('正在刷新...', 'info');
      loadAll();
    }

    // ===== Gateway Control =====
    function confirmRestartGateway() {
      confirmIcon.value = '🔄';
      confirmTitle.value = '重启 Gateway';
      confirmMsg.value = '确认要重启 Gateway 吗？所有活跃连接将中断。';
      confirmAction = async () => {
        try {
          toast('正在重启 Gateway...', 'info');
          await HermesAPI.restartGateway();
          toast('Gateway 重启指令已发送', 'success');
          setTimeout(() => loadGatewayStatus(), 3000);
        } catch (err) {
          toast('重启失败: ' + err.message, 'error');
        }
      };
      showConfirm.value = true;
    }

    async function startGateway() {
      try {
        toast('正在启动 Gateway...', 'info');
        await HermesAPI.restartGateway();
        toast('Gateway 启动指令已发送', 'success');
        setTimeout(() => loadGatewayStatus(), 3000);
      } catch (err) {
        toast('启动失败: ' + err.message, 'error');
      }
    }

    async function loadAll() {
      await Promise.all([
        loadGatewayStatus(),
        loadConfig(),
        loadSessions(),
        loadCronJobs(),
        loadSkills(),
        loadSystemInfo(),
        loadLogs(),
        loadPlugins(),
      ]);
      loadDashboardStats();
      // 检查 Token 配置
      checkTokenStatus();
    }

    async function checkTokenStatus() {
      try {
        const status = await HermesAPI.getTokenStatus();
        if (!status.has_token) {
          showTokenSetup.value = true;
        }
      } catch {
        // API 不可用时不弹窗
      }
    }

    async function saveToken() {
      const token = tokenInput.value.trim();
      if (!token) {
        toast('请输入 Gateway Token', 'error');
        return;
      }
      tokenSaving.value = true;
      try {
        const result = await HermesAPI.saveToken(token);
        if (result.ok) {
          toast('Token 已保存，正在刷新数据...', 'success');
          showTokenSetup.value = false;
          tokenInput.value = '';
          // 重新加载所有数据
          await loadAll();
        } else {
          toast('保存失败: ' + (result.error || '未知错误'), 'error');
        }
      } catch (err) {
        toast('保存失败: ' + err.message, 'error');
      } finally {
        tokenSaving.value = false;
      }
    }

    function skipTokenSetup() {
      showTokenSetup.value = false;
      toast('已跳过配置，部分功能可能不可用', 'info');
    }

    // ===== Page-specific initialization =====
    function onPageLoad(page) {
      if (page === 'dashboard') {
        nextTick(() => initDashboardCharts());
      } else if (page === 'monitor') {
        nextTick(() => initMonitorChart());
      } else if (page === 'logs') {
        nextTick(() => scrollLogs());
      }
    }

    // ===== Charts =====
    function getChartColors() {
      const dark = isDarkTheme.value;
      return {
        textColor: dark ? '#a1a1a1' : '#666666',
        splitColor: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
        tooltipBg: dark ? '#171717' : '#ffffff',
        tooltipBorder: dark ? '#2a2a2a' : '#ebebeb',
        tooltipText: dark ? '#ededed' : '#171717',
      };
    }

    function makeChartOpt() {
      const c = getChartColors();
      return {
        backgroundColor: 'transparent',
        grid: { top: 10, right: 20, bottom: 30, left: 40 },
        xAxis: {
          type: 'category', data: [],
          axisLine: { lineStyle: { color: c.splitColor } },
          axisLabel: { color: c.textColor, fontSize: 10 },
        },
        yAxis: {
          type: 'value', max: 100,
          axisLine: { show: false },
          splitLine: { lineStyle: { color: c.splitColor } },
          axisLabel: { color: c.textColor, fontSize: 10 },
        },
        tooltip: {
          trigger: 'axis',
          backgroundColor: c.tooltipBg,
          borderColor: c.tooltipBorder,
          textStyle: { color: c.tooltipText },
        },
      };
    }

    function makeLineSeries(color) {
      return [{
        type: 'line', data: [], smooth: true,
        lineStyle: { color, width: 2 },
        areaStyle: {
          color: {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: color.replace(')', ',0.3)').replace('rgb', 'rgba') },
              { offset: 1, color: color.replace(')', ',0)').replace('rgb', 'rgba') },
            ],
          },
        },
        itemStyle: { color },
      }];
    }

    function initDashboardCharts() {
      if (cpuChartEl.value && !cpuChartInst) {
        cpuChartInst = echarts.init(cpuChartEl.value);
        cpuChartInst.setOption({
          ...makeChartOpt(),
          series: [{
            type: 'line', data: [], smooth: true, symbol: 'none',
            lineStyle: { color: '#525252', width: 2 },
            areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(82,82,82,0.15)' }, { offset: 1, color: 'rgba(82,82,82,0)' }] } },
            itemStyle: { color: '#525252' },
          }],
        });
      }
      if (memChartEl.value && !memChartInst) {
        memChartInst = echarts.init(memChartEl.value);
        memChartInst.setOption({
          ...makeChartOpt(),
          series: [{
            type: 'line', data: [], smooth: true, symbol: 'none',
            lineStyle: { color: '#a1a1a1', width: 2 },
            areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(161,161,161,0.15)' }, { offset: 1, color: 'rgba(161,161,161,0)' }] } },
            itemStyle: { color: '#a1a1a1' },
          }],
        });
      }
    }

    function initMonitorChart() {
      if (monitorChartEl.value && !monitorChartInst) {
        monitorChartInst = echarts.init(monitorChartEl.value);
        monitorChartInst.setOption({
          ...makeChartOpt(),
          grid: { top: 30, right: 20, bottom: 30, left: 40 },
          legend: { data: ['CPU', '内存'], textStyle: { color: isDarkTheme.value ? '#a1a1a1' : '#666666' }, top: 0 },
          series: [
            { name: 'CPU', type: 'line', data: [], smooth: true, symbol: 'none', lineStyle: { color: '#525252', width: 2 }, itemStyle: { color: '#525252' } },
            { name: '内存', type: 'line', data: [], smooth: true, symbol: 'none', lineStyle: { color: '#a1a1a1', width: 2 }, itemStyle: { color: '#a1a1a1' } },
          ],
        });
      }
    }

    function updateCharts() {
      const cpuX = monitorCpuData.value.map(d => d.time);
      const cpuY = monitorCpuData.value.map(d => d.value);
      const memY = monitorMemData.value.map(d => d.value);

      if (cpuChartInst) {
        cpuChartInst.setOption({ xAxis: { data: cpuX }, series: [{ data: cpuY }] });
      }
      if (memChartInst) {
        memChartInst.setOption({ xAxis: { data: cpuX }, series: [{ data: memY }] });
      }
      if (monitorChartInst) {
        monitorChartInst.setOption({
          xAxis: { data: cpuX },
          series: [{ data: cpuY }, { data: memY }],
        });
      }
    }

    // ===== Computed =====
    const filteredSessions = computed(() => {
      if (!sessionSearch.value) return sessions.value;
      const q = sessionSearch.value.toLowerCase();
      return sessions.value.filter(s =>
        (s.title || '').toLowerCase().includes(q) ||
        (s.id || '').toLowerCase().includes(q) ||
        (s.source || '').toLowerCase().includes(q)
      );
    });

    const totalSessionPages = computed(() => Math.ceil(filteredSessions.value.length / sessionPageSize));
    const paginatedSessions = computed(() => {
      const start = (sessionPage.value - 1) * sessionPageSize;
      return filteredSessions.value.slice(start, start + sessionPageSize);
    });

    const filteredSkills = computed(() => {
      let result = skills.value;
      if (skillCategoryFilter.value) {
        result = result.filter(s => (s.category || '通用') === skillCategoryFilter.value);
      }
      if (skillSearch.value) {
        const q = skillSearch.value.toLowerCase();
        result = result.filter(s =>
          (s.name || '').toLowerCase().includes(q) ||
          (s.description || '').toLowerCase().includes(q)
        );
      }
      return result;
    });

    const skillCategories = computed(() => {
      const cats = new Set(skills.value.map(s => s.category || '通用'));
      return [...cats].sort();
    });

    function openSkillDetail(skill) {
      selectedSkill.value = skill;
    }

    const filteredLogs = computed(() => {
      let logs = logEntries.value;
      if (logLevel.value) {
        logs = logs.filter(l => l.level === logLevel.value);
      }
      if (logSearch.value) {
        const q = logSearch.value.toLowerCase();
        logs = logs.filter(l => (l.msg || '').toLowerCase().includes(q));
      }
      return logs;
    });

    // Model suggestions based on selected provider
    const modelSuggestions = computed(() => {
      const provider = switchForm.value.provider;
      if (!provider) return [];
      // Check known models first
      if (knownModels[provider]) return knownModels[provider];
      // Fallback: try to extract from provider config
      const conf = appConfig.value.providers?.[provider];
      if (conf?.models && Array.isArray(conf.models)) return conf.models;
      return [];
    });

    function onProviderChange() {
      switchForm.value.model = '';
      customModelName.value = '';
      switchResult.value = null;
    }

    function onModelSelectChange() {
      switchResult.value = null;
      if (switchForm.value.model !== '__custom__') {
        customModelName.value = '';
      }
    }

    function isKnownModel(name) {
      const provider = switchForm.value.provider;
      if (!provider) return false;
      const models = knownModels[provider] || appConfig.value.providers?.[provider]?.models || [];
      return models.includes(name);
    }

    function selectProvider(name) {
      switchForm.value.provider = name;
      switchForm.value.model = '';
      customModelName.value = '';
      switchResult.value = null;
    }

    async function quickSwitchModel(provider, model) {
      switchForm.value.provider = provider;
      switchForm.value.model = model;
      customModelName.value = '';
      // Immediately switch
      await switchModel();
    }

    function getProviderIcon(name) {
      const icons = {
        openai: '🟢', anthropic: '🟠', deepseek: '🔵', google: '🔴',
        qwen: '🟣', mimo: '⚡', 'minimax-cn': '🟡',
      };
      return icons[name] || '🔧';
    }

    function getProviderUrlHint(name) {
      return providerUrlHints[name] || '';
    }

    // Available providers (not yet configured)
    const availableProviders = computed(() => {
      const configured = Object.keys(appConfig.value.providers || {});
      return Object.keys(knownModels).filter(p => !configured.includes(p));
    });

    // Can switch model?
    const canSwitchModel = computed(() => {
      if (!switchForm.value.provider) return false;
      if (switchForm.value.model === '__custom__') return !!customModelName.value.trim();
      return !!switchForm.value.model;
    });

    // Provider management
    function openProviderForm(mode, name = '', conf = {}) {
      providerFormMode.value = mode;
      providerForm.value = {
        name: name,
        base_url: conf.base_url || '',
        api_key: conf.api_key || '',
      };
      showProviderForm.value = true;
    }

    async function submitProviderForm() {
      const form = providerForm.value;
      if (!form.name.trim()) {
        toast('提供商名称不能为空', 'error');
        return;
      }
      try {
        const config = { ...appConfig.value };
        if (!config.providers) config.providers = {};
        config.providers[form.name] = {
          base_url: form.base_url || undefined,
          api_key: form.api_key || undefined,
        };
        await HermesAPI.updateConfig(config);
        toast(providerFormMode.value === 'create' ? '提供商已添加' : '提供商已更新', 'success');
        showProviderForm.value = false;
        await loadConfig();
      } catch (err) {
        toast('操作失败: ' + err.message, 'error');
      }
    }

    function confirmDeleteProvider(name) {
      confirmIcon.value = '🗑️';
      confirmTitle.value = '删除提供商';
      confirmMsg.value = `确认要删除提供商「${name}」吗？此操作不可撤销。`;
      confirmAction = () => deleteProvider(name);
      showConfirm.value = true;
    }

    async function deleteProvider(name) {
      try {
        const config = { ...appConfig.value };
        if (config.providers) {
          delete config.providers[name];
        }
        await HermesAPI.updateConfig(config);
        toast('提供商已删除', 'success');
        if (switchForm.value.provider === name) {
          switchForm.value.provider = '';
          switchForm.value.model = '';
        }
        await loadConfig();
      } catch (err) {
        toast('删除失败: ' + err.message, 'error');
      }
    }

    const filteredPlugins = computed(() => {
      let result = plugins.value;
      if (pluginTypeFilter.value) {
        if (pluginTypeFilter.value === 'mcp') {
          // MCP tab matches both mcp and mcp_native
          result = result.filter(p => p.type === 'mcp' || p.type === 'mcp_native');
        } else {
          result = result.filter(p => p.type === pluginTypeFilter.value);
        }
      }
      if (pluginSearch.value) {
        const q = pluginSearch.value.toLowerCase();
        result = result.filter(p =>
          (p.name || '').toLowerCase().includes(q) ||
          (p.description || '').toLowerCase().includes(q)
        );
      }
      return result;
    });

    // ===== Watchers =====
    watch(sidebarCollapsed, v => Utils.store.set('sidebar_collapsed', v));
    watch(filteredLogs, () => {
      if (autoScroll.value) nextTick(() => scrollLogs());
    });

    function scrollLogs() {
      if (logViewer.value) {
        logViewer.value.scrollTop = logViewer.value.scrollHeight;
      }
    }

    // ===== Plugin helpers =====
    function getPluginIcon(type) {
      const icons = {
        mcp: '🔌',
        mcp_native: '🔗',
        toolset: '🛠️',
        platform_toolset: '📡',
      };
      return icons[type] || '📦';
    }

    function getPluginTypeLabel(type) {
      const labels = {
        mcp: 'MCP',
        mcp_native: '原生 MCP',
        toolset: '工具集',
        platform_toolset: '平台工具集',
      };
      return labels[type] || type;
    }

    function getPluginBadgeClass(type) {
      const classes = {
        mcp: 'badge-blue',
        mcp_native: 'badge-green',
        toolset: 'badge-yellow',
        platform_toolset: 'badge-purple',
      };
      return classes[type] || 'badge-gray';
    }

    function openPluginDetail(plugin) {
      selectedPlugin.value = plugin;
    }

    function togglePlugin(plugin) {
      plugin.enabled = !plugin.enabled;
      toast(plugin.enabled ? `已启用 ${plugin.name}` : `已禁用 ${plugin.name}`, plugin.enabled ? 'success' : 'info');
      // If toggled from detail modal, update reference
      if (selectedPlugin.value && selectedPlugin.value.name === plugin.name) {
        selectedPlugin.value = { ...plugin };
      }
    }

    // ===== Lifecycle =====
    onMounted(() => {
      // Apply saved theme
      applyTheme(isDarkTheme.value);

      // Auto-connect: no setup dialog needed, backend handles Gateway auth
      loadAll();

      // Start log auto-refresh
      startLogRefresh();

      const hash = window.location.hash.replace('#/', '');
      if (hash && pageTitleMap[hash]) {
        currentPage.value = hash;
      }

      // 定时刷新
      setInterval(() => {
        loadGatewayStatus();
        loadSystemInfo();
      }, 10000);

      setInterval(updateCharts, 5000);

      window.addEventListener('resize', () => {
        cpuChartInst?.resize();
        memChartInst?.resize();
        monitorChartInst?.resize();
      });

      nextTick(() => onPageLoad(currentPage.value));
    });

    return {
      sidebarCollapsed, mobileMenuOpen, currentPage, currentPageTitle,
      menuItems, navigate,
      gatewayRunning, gatewayAdapters,
      dashboardStats, configModels, recentLogs,
      cpuChartEl, memChartEl,
      sessions, sessionSearch, filteredSessions, loadSessions, deleteSession, confirmDeleteSession,
      editingSessionId, editingSessionTitle, startEditSession, saveEditSession, cancelEditSession,
      sessionPage, totalSessionPages, paginatedSessions,
      selectedSession, sessionMessages, sessionLoading, sessionTotal, sessionDetailTitle, openSessionDetail, refreshSessionDetail,
      cronJobs, loadCronJobs, toggleCron, runCron, deleteCron, confirmDeleteCron,
      showCronForm, cronFormMode, cronForm, cronFormSubmitting, openCronForm, resetCronForm, submitCronForm,
      skills, skillSearch, filteredSkills, loadSkills, skillCategoryFilter, skillCategories, selectedSkill, openSkillDetail,
      appConfig, switchForm, switchResult, switchModel,
      modelSuggestions, onProviderChange, customModelName, knownModels,
      onModelSelectChange, isKnownModel, canSwitchModel,
      selectProvider, quickSwitchModel, getProviderIcon,
      availableProviders, getProviderUrlHint,
      showProviderForm, providerFormMode, providerForm, openProviderForm, submitProviderForm, confirmDeleteProvider,
      editableConfig, saveSettings, loadConfig,
      logEntries, filteredLogs, logLevel, logSearch, autoScroll, loadLogs, logViewer,
      autoRefresh, toggleAutoRefresh,
      systemInfo, monitorChartEl,
      monitorCpuData, monitorMemData,
      plugins, pluginSearch, pluginTypeFilter, filteredPlugins, loadPlugins,
      selectedPlugin, openPluginDetail, togglePlugin,
      getPluginIcon, getPluginTypeLabel, getPluginBadgeClass,
      toasts, refreshData,
      formatTime: Utils.formatTime,
      maskKey: Utils.maskKey,
      describeCron: Utils.describeCron,
      getChannelIcon: Utils.getChannelIcon,
      getChannelLabel: Utils.getChannelLabel,
      getChannelDescription: Utils.getChannelDescription,
      getBarColor: Utils.getBarColor,
      highlightLogMsg: Utils.highlightLogMsg,
      officialConsoleUrl,
      confirmRestartGateway, startGateway,
      showConfirm, confirmIcon, confirmTitle, confirmMsg,
      confirmAction,
      isDarkTheme, toggleTheme,
      showTokenSetup, tokenInput, tokenSaving, saveToken, skipTokenSetup, checkTokenStatus,
    };
  },
});

app.mount('#app');
