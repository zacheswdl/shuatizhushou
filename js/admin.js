/**
 * Admin Module
 * Login, question CRUD, chapter management
 * All CRUD operations use async Supabase-backed Storage methods.
 */
var Admin = (function() {
  var _tab = 'questions'; // 'questions' | 'chapters' | 'add' | 'users'
  var _page = 1;
  var _pageSize = 10;
  var _filterChapter = '';
  var _filterType = '';
  var _editingQ = null;
  var _users = [];

  async function render() {
    var container = document.getElementById('pageAdmin');
    if (!container) return;

    container.innerHTML = '<div class="card" style="text-align:center;color:var(--gray-400)">加载中...</div>';

    var user = await Auth.getCurrentUser();
    if (!user) {
      _renderNeedLogin(container);
      return;
    }

    await Auth.ensureProfile();
    if (!(await Auth.isAdmin(true))) {
      _renderForbidden(container);
      return;
    }

    _users = await Storage.listUsers();
    _renderPanel(container);
  }

  function _renderNeedLogin(container) {
    container.innerHTML = '<div class="admin-login">' +
      '<div style="width:64px;height:64px;background:var(--purple-light);border-radius:20px;display:flex;align-items:center;justify-content:center;margin:0 auto 20px">' +
        '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--purple)" stroke-width="2"><path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>' +
      '</div>' +
      '<h3>后台管理</h3>' +
      '<p>请先使用管理员邮箱登录刷题助手</p>' +
      '<button class="btn btn-primary btn-block" onclick="Auth.renderModal()">前往登录</button>' +
    '</div>';
  }

  function _renderForbidden(container) {
    container.innerHTML = '<div class="admin-login">' +
      '<div style="width:64px;height:64px;background:var(--danger-light);border-radius:20px;display:flex;align-items:center;justify-content:center;margin:0 auto 20px">' +
        '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>' +
      '</div>' +
      '<h3>无管理员权限</h3>' +
      '<p>当前登录邮箱为 ' + App.escHtml(Auth.getCurrentUserEmail() || '未登录') + '，请先授予管理员角色后再访问后台。</p>' +
      '<button class="btn btn-outline btn-block" onclick="Auth.signOut()">退出当前账号</button>' +
    '</div>';
  }

  function _renderPanel(container) {
    var html = '<div class="admin-panel">';

    // Tabs
    html += '<div class="admin-tabs">' +
      '<button class="admin-tab ' + (_tab === 'questions' ? 'active' : '') + '" onclick="Admin.setTab(\'questions\')">题库管理</button>' +
      '<button class="admin-tab ' + (_tab === 'chapters' ? 'active' : '') + '" onclick="Admin.setTab(\'chapters\')">章节管理</button>' +
      '<button class="admin-tab ' + (_tab === 'users' ? 'active' : '') + '" onclick="Admin.setTab(\'users\')">用户管理</button>' +
      '<button class="admin-tab ' + (_tab === 'add' ? 'active' : '') + '" onclick="Admin.setTab(\'add\')">' + (_editingQ ? '编辑题目' : '新增题目') + '</button>' +
    '</div>';

    if (_tab === 'questions') {
      html += _renderQuestionList();
    } else if (_tab === 'chapters') {
      html += _renderChapterManage();
    } else if (_tab === 'users') {
      html += _renderUserManage();
    } else if (_tab === 'add') {
      html += _renderAddEdit();
    }

    // Logout
    html += '<div style="text-align:center;padding:16px 0;margin-top:16px">' +
      '<button class="btn-reset" onclick="Auth.signOut()">退出登录</button></div>';

    html += '</div>';
    container.innerHTML = html;
  }

  function _renderUserManage() {
    var currentUserId = Auth.getCurrentUserId();
    var html = '<div style="font-size:13px;color:var(--gray-400);margin-bottom:12px">共 ' + _users.length + ' 个账号</div>';
    html += '<div class="card" style="padding:4px 16px">';

    if (_users.length === 0) {
      html += '<div style="padding:24px;text-align:center;color:var(--gray-400)">暂无用户数据，请先执行新的 Supabase SQL 脚本</div>';
      html += '</div>';
      return html;
    }

    _users.forEach(function(user) {
      html += '<div style="display:flex;align-items:center;gap:12px;padding:14px 0;border-bottom:1px solid var(--gray-100)">' +
        '<div style="flex:1;min-width:0">' +
          '<div style="font-size:14px;color:var(--gray-900);word-break:break-all">' + App.escHtml(user.email || '(无邮箱)') + '</div>' +
          '<div style="display:flex;gap:8px;align-items:center;margin-top:6px">' +
            '<span class="tag ' + (user.role === 'admin' ? 'tag-purple' : 'tag-blue') + '">' + (user.role === 'admin' ? '管理员' : '普通用户') + '</span>' +
            '<span class="tag ' + (user.is_banned ? 'tag-red' : 'tag-green') + '">' + (user.is_banned ? '已封禁' : '正常') + '</span>' +
          '</div>' +
        '</div>' +
        (
          user.id === currentUserId
            ? '<span style="font-size:12px;color:var(--gray-400)">当前账号</span>'
            : '<button class="btn ' + (user.is_banned ? 'btn-outline' : 'btn-danger') + ' btn-sm" onclick="Admin.toggleUserBan(\'' + user.id + '\',' + (user.is_banned ? 'false' : 'true') + ')">' + (user.is_banned ? '解除封禁' : '封禁账号') + '</button>'
        ) +
      '</div>';
    });

    html += '</div>';
    return html;
  }

  function _renderQuestionList() {
    var allQ = App.getAllQuestions();
    var chapters = App.getAllChapters();

    // Filter
    var filtered = allQ;
    if (_filterChapter) filtered = filtered.filter(function(q) { return q.chapterId === _filterChapter; });
    if (_filterType) filtered = filtered.filter(function(q) { return q.type === _filterType; });

    var totalPages = Math.ceil(filtered.length / _pageSize) || 1;
    if (_page > totalPages) _page = totalPages;
    var start = (_page - 1) * _pageSize;
    var pageItems = filtered.slice(start, start + _pageSize);

    var html = '<div class="filter-row">' +
      '<select onchange="Admin.filterChapter(this.value)">' +
        '<option value="">全部章节</option>';
    chapters.forEach(function(ch) {
      html += '<option value="' + ch.id + '" ' + (_filterChapter === ch.id ? 'selected' : '') + '>' + App.escHtml(ch.name) + '</option>';
    });
    html += '</select>' +
      '<select onchange="Admin.filterType(this.value)">' +
        '<option value="">全部题型</option>' +
        '<option value="single" ' + (_filterType === 'single' ? 'selected' : '') + '>单选</option>' +
        '<option value="multiple" ' + (_filterType === 'multiple' ? 'selected' : '') + '>多选</option>' +
        '<option value="judgement" ' + (_filterType === 'judgement' ? 'selected' : '') + '>判断</option>' +
        '<option value="essay" ' + (_filterType === 'essay' ? 'selected' : '') + '>简答</option>' +
      '</select></div>';

    html += '<div style="font-size:13px;color:var(--gray-400);margin-bottom:12px">共 ' + filtered.length + ' 题</div>';

    html += '<div class="card" style="padding:4px 16px">';
    if (pageItems.length === 0) {
      html += '<div style="padding:24px;text-align:center;color:var(--gray-400)">暂无题目</div>';
    }
    pageItems.forEach(function(q, idx) {
      var chName = '';
      chapters.forEach(function(ch) { if (ch.id === q.chapterId) chName = ch.name; });
      html += '<div class="question-list-item">' +
        '<div class="ql-content">' +
          '<div class="ql-stem">' + App.escHtml(q.question) + '</div>' +
          '<div class="ql-meta">' +
            '<span class="tag ' + App.getTypeTag(q.type) + '">' + App.getTypeLabel(q.type) + '</span>' +
            '<span style="font-size:11px;color:var(--gray-400)">' + App.escHtml(chName) + '</span>' +
          '</div>' +
        '</div>' +
        '<div class="ql-actions">' +
          '<button onclick="Admin.editQuestion(\'' + q.id + '\')" title="编辑"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg></button>' +
          '<button class="delete-btn" onclick="Admin.deleteQuestion(\'' + q.id + '\')" title="删除"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>' +
        '</div>' +
      '</div>';
    });
    html += '</div>';

    // Pagination
    if (totalPages > 1) {
      html += '<div class="pagination">' +
        '<button onclick="Admin.goPage(' + (_page - 1) + ')" ' + (_page <= 1 ? 'disabled' : '') + '>上一页</button>' +
        '<span>' + _page + '/' + totalPages + '</span>' +
        '<button onclick="Admin.goPage(' + (_page + 1) + ')" ' + (_page >= totalPages ? 'disabled' : '') + '>下一页</button>' +
      '</div>';
    }

    return html;
  }

  function _renderChapterManage() {
    var chapters = App.getAllChapters();
    var html = '<div class="card">';

    chapters.forEach(function(ch, idx) {
      html += '<div style="display:flex;align-items:center;padding:12px 0;border-bottom:1px solid var(--gray-100);gap:12px">' +
        '<span style="font-size:14px;color:var(--gray-400);width:24px">' + (idx + 1) + '</span>' +
        '<span style="flex:1;font-size:15px;color:var(--gray-800)">' + App.escHtml(ch.name) + '</span>' +
        '<span style="font-size:12px;color:var(--gray-400)">' + App.getQuestionsByChapter(ch.id).length + '题</span>' +
      '</div>';
    });

    html += '</div>';

    html += '<div style="margin-top:16px">' +
      '<div class="form-group">' +
        '<label class="form-label">新增章节名称</label>' +
        '<input type="text" class="form-input" id="newChapterName" placeholder="请输入章节名称">' +
      '</div>' +
      '<button class="btn btn-primary btn-block" onclick="Admin.addChapter()">添加章节</button>' +
    '</div>';

    return html;
  }

  function _renderAddEdit() {
    var chapters = App.getAllChapters();
    var q = _editingQ;

    var html = '<div class="card">';

    html += '<div class="form-group">' +
      '<label class="form-label">所属章节</label>' +
      '<select class="form-select" id="qChapter">';
    chapters.forEach(function(ch) {
      html += '<option value="' + ch.id + '" ' + (q && q.chapterId === ch.id ? 'selected' : '') + '>' + App.escHtml(ch.name) + '</option>';
    });
    html += '</select></div>';

    html += '<div class="form-group">' +
      '<label class="form-label">题型</label>' +
      '<select class="form-select" id="qType">' +
        '<option value="single" ' + (q && q.type === 'single' ? 'selected' : '') + '>单选题</option>' +
        '<option value="multiple" ' + (q && q.type === 'multiple' ? 'selected' : '') + '>多选题</option>' +
        '<option value="judgement" ' + (q && q.type === 'judgement' ? 'selected' : '') + '>判断题</option>' +
        '<option value="essay" ' + (q && q.type === 'essay' ? 'selected' : '') + '>简答题</option>' +
      '</select></div>';

    html += '<div class="form-group">' +
      '<label class="form-label">题干</label>' +
      '<textarea class="form-textarea" id="qStem" rows="3" placeholder="请输入题目内容">' + (q ? App.escHtml(q.question) : '') + '</textarea></div>';

    html += '<div class="form-group" id="optionsGroup">' +
      '<label class="form-label">选项（每行一个，格式如 A. 内容）</label>' +
      '<textarea class="form-textarea" id="qOptions" rows="5" placeholder="A. 选项1\nB. 选项2\nC. 选项3\nD. 选项4">' +
      (q && q.options ? q.options.join('\n') : '') + '</textarea></div>';

    html += '<div class="form-group">' +
      '<label class="form-label">答案（选择题填字母如 A 或 ABC，简答题填参考答案）</label>' +
      '<textarea class="form-textarea" id="qAnswer" rows="2" placeholder="正确答案">' + (q ? App.escHtml(q.answer) : '') + '</textarea></div>';

    html += '<div class="form-group">' +
      '<label class="form-label">解析</label>' +
      '<textarea class="form-textarea" id="qExplanation" rows="3" placeholder="答案解析（选填）">' + (q ? App.escHtml(q.explanation || '') : '') + '</textarea></div>';

    html += '</div>';

    html += '<div style="display:flex;gap:12px;margin-top:16px">';
    if (_editingQ) {
      html += '<button class="btn btn-outline" style="flex:1" onclick="Admin.cancelEdit()">取消</button>';
      html += '<button class="btn btn-primary" style="flex:1" onclick="Admin.saveEdit()">保存修改</button>';
    } else {
      html += '<button class="btn btn-primary btn-block" onclick="Admin.saveNew()">添加题目</button>';
    }
    html += '</div>';

    return html;
  }

  function setTab(tab) {
    _tab = tab;
    if (tab !== 'add') _editingQ = null;
    render();
  }

  function filterChapter(v) { _filterChapter = v; _page = 1; render(); }
  function filterType(v) { _filterType = v; _page = 1; render(); }
  function goPage(p) { _page = p; render(); document.getElementById('mainContent').scrollTop = 0; }

  function editQuestion(qId) {
    _editingQ = App.getQuestionById(qId);
    _tab = 'add';
    render();
    document.getElementById('mainContent').scrollTop = 0;
  }

  function deleteQuestion(qId) {
    App.showModal('删除题目', '确定要删除这道题目吗？此操作不可恢复。', [
      { text: '取消', cls: 'btn-outline' },
      { text: '删除', cls: 'btn-danger', fn: async function() {
        var ok = await Storage.deleteQuestion(qId);
        if (ok) {
          await App.reloadData();
          App.toast('已删除');
          render();
        } else {
          App.toast('删除失败，请重试');
        }
      }}
    ]);
  }

  function cancelEdit() {
    _editingQ = null;
    _tab = 'questions';
    render();
  }

  function _getFormData() {
    var chapter = document.getElementById('qChapter').value;
    var type = document.getElementById('qType').value;
    var stem = document.getElementById('qStem').value.trim();
    var optText = document.getElementById('qOptions').value.trim();
    var answer = document.getElementById('qAnswer').value.trim();
    var explanation = document.getElementById('qExplanation').value.trim();

    if (!stem) { App.toast('请输入题干'); return null; }
    if (!answer) { App.toast('请输入答案'); return null; }

    var options = [];
    if (type !== 'essay') {
      options = optText.split('\n').map(function(s) { return s.trim(); }).filter(Boolean);
      if (options.length < 2) { App.toast('选择题至少需要2个选项'); return null; }
    }

    return {
      chapterId: chapter,
      type: type,
      question: stem,
      options: options,
      answer: answer,
      explanation: explanation
    };
  }

  async function saveNew() {
    var data = _getFormData();
    if (!data) return;

    data.id = 'q_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
    var ok = await Storage.addQuestion(data);
    if (ok) {
      await App.reloadData();
      App.toast('添加成功');
      _tab = 'questions';
      render();
    } else {
      App.toast('添加失败，请重试');
    }
  }

  async function saveEdit() {
    var data = _getFormData();
    if (!data) return;

    data.id = _editingQ.id;
    var ok = await Storage.updateQuestion(data);
    if (ok) {
      await App.reloadData();
      App.toast('修改成功');
      _editingQ = null;
      _tab = 'questions';
      render();
    } else {
      App.toast('修改失败，请重试');
    }
  }

  async function addChapter() {
    var name = document.getElementById('newChapterName').value.trim();
    if (!name) { App.toast('请输入章节名称'); return; }

    var chapters = App.getAllChapters();
    var newCh = {
      id: 'ch_' + Date.now(),
      name: name,
      order: chapters.length + 1
    };
    var ok = await Storage.addChapter(newCh);
    if (ok) {
      await App.reloadData();
      App.toast('章节已添加');
      render();
    } else {
      App.toast('添加章节失败，请重试');
    }
  }

  async function toggleUserBan(userId, banned) {
    var target = null;
    for (var i = 0; i < _users.length; i++) {
      if (_users[i].id === userId) {
        target = _users[i];
        break;
      }
    }

    if (!target) {
      App.toast('未找到目标用户');
      return;
    }

    var actionText = banned ? '封禁' : '解除封禁';
    var body = '确定要' + actionText + '账号：<br>' + App.escHtml(target.email || '(无邮箱)') + ' 吗？';
    if (banned) body += '<br><br>封禁后该账号将无法继续访问刷题助手。';

    App.showModal(actionText + '账号', body, [
      { text: '取消', cls: 'btn-outline' },
      { text: actionText, cls: banned ? 'btn-danger' : 'btn-primary', fn: async function() {
        var ok = await Storage.setUserBanStatus(userId, banned);
        if (ok) {
          App.toast(banned ? '已封禁该账号' : '已解除封禁');
          await render();
        } else {
          App.toast(actionText + '失败，请确认已执行最新 SQL 脚本');
        }
      }}
    ]);
  }

  return {
    render: render,
    setTab: setTab,
    filterChapter: filterChapter,
    filterType: filterType,
    goPage: goPage,
    editQuestion: editQuestion,
    deleteQuestion: deleteQuestion,
    cancelEdit: cancelEdit,
    saveNew: saveNew,
    saveEdit: saveEdit,
    addChapter: addChapter,
    toggleUserBan: toggleUserBan
  };
})();
