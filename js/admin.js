/**
 * Admin Module
 * Login, question CRUD, chapter management
 * All CRUD operations use async Supabase-backed Storage methods.
 */
var Admin = (function() {
  var _tab = 'questions'; // 'questions' | 'chapters' | 'add'
  var _page = 1;
  var _pageSize = 10;
  var _filterChapter = '';
  var _filterType = '';
  var _editingQ = null;

  function render() {
    var container = document.getElementById('pageAdmin');
    if (!Storage.getAdminAuth()) {
      _renderLogin(container);
    } else {
      _renderPanel(container);
    }
  }

  function _renderLogin(container) {
    container.innerHTML = '<div class="admin-login">' +
      '<div style="width:64px;height:64px;background:var(--purple-light);border-radius:20px;display:flex;align-items:center;justify-content:center;margin:0 auto 20px">' +
        '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--purple)" stroke-width="2"><path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>' +
      '</div>' +
      '<h3>后台管理</h3>' +
      '<p>请输入管理员密码</p>' +
      '<div class="form-group">' +
        '<input type="password" class="form-input" id="adminPass" placeholder="管理员密码" onkeypress="if(event.key===\'Enter\')Admin.login()">' +
      '</div>' +
      '<button class="btn btn-primary btn-block" onclick="Admin.login()">登录</button>' +
    '</div>';
  }

  function login() {
    var pass = document.getElementById('adminPass').value;
    if (pass === CONFIG.ADMIN_PASS) {
      Storage.setAdminAuth(true);
      render();
      App.toast('登录成功');
    } else {
      App.toast('密码错误');
    }
  }

  function logout() {
    Storage.setAdminAuth(false);
    render();
  }

  function _renderPanel(container) {
    var html = '<div class="admin-panel">';

    // Tabs
    html += '<div class="admin-tabs">' +
      '<button class="admin-tab ' + (_tab === 'questions' ? 'active' : '') + '" onclick="Admin.setTab(\'questions\')">题库管理</button>' +
      '<button class="admin-tab ' + (_tab === 'chapters' ? 'active' : '') + '" onclick="Admin.setTab(\'chapters\')">章节管理</button>' +
      '<button class="admin-tab ' + (_tab === 'add' ? 'active' : '') + '" onclick="Admin.setTab(\'add\')">' + (_editingQ ? '编辑题目' : '新增题目') + '</button>' +
    '</div>';

    if (_tab === 'questions') {
      html += _renderQuestionList();
    } else if (_tab === 'chapters') {
      html += _renderChapterManage();
    } else if (_tab === 'add') {
      html += _renderAddEdit();
    }

    // Logout
    html += '<div style="text-align:center;padding:16px 0;margin-top:16px">' +
      '<button class="btn-reset" onclick="Admin.logout()">退出登录</button></div>';

    html += '</div>';
    container.innerHTML = html;
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

  return {
    render: render,
    login: login,
    logout: logout,
    setTab: setTab,
    filterChapter: filterChapter,
    filterType: filterType,
    goPage: goPage,
    editQuestion: editQuestion,
    deleteQuestion: deleteQuestion,
    cancelEdit: cancelEdit,
    saveNew: saveNew,
    saveEdit: saveEdit,
    addChapter: addChapter
  };
})();
