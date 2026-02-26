/**
 * Wrong Answers Book Module
 */
var Wrong = (function() {
  var _currentQ = null;
  var _answered = {};
  var _revealed = {};
  var _viewMode = 'list'; // 'list' or 'detail'
  var _detailIdx = 0;
  var _wrongQs = [];

  function render() {
    _viewMode = 'list';
    _renderList();
  }

  function _renderList() {
    var container = document.getElementById('pageWrong');
    var wrongIds = Storage.getWrongList();

    if (wrongIds.length === 0) {
      container.innerHTML = '<div class="empty-state">' +
        '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>' +
        '<p>暂无错题，继续保持</p></div>';
      return;
    }

    _wrongQs = wrongIds.map(function(id) { return App.getQuestionById(id); }).filter(Boolean);

    var html = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">' +
      '<span style="font-size:14px;color:var(--gray-500)">共 ' + _wrongQs.length + ' 道错题</span>' +
      '<div style="display:flex;gap:8px">' +
        '<button class="btn btn-sm btn-outline" onclick="Wrong.practiceAll()">错题练习</button>' +
        '<button class="btn btn-sm btn-danger" onclick="Wrong.clearAll()">清空</button>' +
      '</div>' +
    '</div>';

    html += '<div class="card" style="padding:4px 16px">';
    _wrongQs.forEach(function(q, idx) {
      html += '<div class="review-item" onclick="Wrong.viewDetail(' + idx + ')">' +
        '<div class="review-stem">' + App.escHtml(q.question) + '</div>' +
        '<div class="review-meta">' +
          '<span class="tag ' + App.getTypeTag(q.type) + '">' + App.getTypeLabel(q.type) + '</span>' +
        '</div>' +
      '</div>';
    });
    html += '</div>';

    container.innerHTML = html;
  }

  function viewDetail(idx) {
    _detailIdx = idx;
    _viewMode = 'detail';
    _answered = {};
    _revealed = {};
    _renderDetail();
  }

  function _renderDetail() {
    var container = document.getElementById('pageWrong');
    var q = _wrongQs[_detailIdx];
    if (!q) return;

    document.getElementById('headerTitle').textContent = '错题 (' + (_detailIdx + 1) + '/' + _wrongQs.length + ')';

    var hasAnswered = _answered.hasOwnProperty(q.id);
    var isRevealed = _revealed[q.id];
    var isFav = Storage.isFavorite(q.id);
    var userAns = _answered[q.id] || (q.type === 'multiple' ? [] : '');

    var html = '<div class="question-card">';
    html += '<div class="q-header"><span class="tag ' + App.getTypeTag(q.type) + '">' + App.getTypeLabel(q.type) + '</span></div>';
    html += '<div class="q-stem">' + App.escHtml(q.question).replace(/\n/g, '<br>') + '</div>';

    if (q.type === 'essay') {
      if (!isRevealed) {
        html += '<button class="btn btn-primary btn-block" onclick="Wrong.revealEssay(\'' + q.id + '\')">查看参考答案</button>';
      } else {
        html += '<div class="answer-box"><div class="ans-title">参考答案</div>' +
          '<div class="ans-content">' + App.escHtml(q.answer).replace(/\n/g, '<br>') + '</div></div>';
      }
    } else {
      q.options.forEach(function(opt, i) {
        var letter = String.fromCharCode(65 + i);
        var cls = 'option-item';
        if (q.type === 'multiple') cls += ' multi';

        if (isRevealed) {
          cls += ' disabled';
          var isCorrect = q.answer.indexOf(letter) !== -1;
          var isSelected = q.type === 'multiple' ? userAns.indexOf(letter) !== -1 : userAns === letter;
          if (isCorrect) cls += ' correct';
          else if (isSelected && !isCorrect) cls += ' wrong';
        } else {
          var isSel = q.type === 'multiple' ? userAns.indexOf(letter) !== -1 : userAns === letter;
          if (isSel) cls += ' selected';
        }

        html += '<div class="' + cls + '" onclick="Wrong.selectOpt(\'' + q.id + '\',\'' + letter + '\')">' +
          '<div class="option-label">' + letter + '</div>' +
          '<div class="option-text">' + App.escHtml(opt.replace(/^[A-E]\.\s*/, '')) + '</div>' +
        '</div>';
      });

      if (!isRevealed && q.type === 'multiple') {
        html += '<button class="btn btn-primary btn-block" onclick="Wrong.confirmAns(\'' + q.id + '\')" ' +
          (!hasAnswered || userAns.length === 0 ? 'disabled' : '') + '>确认</button>';
      }
      if (isRevealed) {
        html += '<div class="answer-box"><div class="ans-title">正确答案</div><div class="ans-content">' + q.answer + '</div></div>';
      }
    }

    if (isRevealed && q.explanation) {
      html += '<div class="explanation-box"><div class="exp-title">解析</div>' +
        '<div class="exp-content">' + App.escHtml(q.explanation) + '</div></div>';
    }

    // Actions
    html += '<div class="q-actions">' +
      '<button class="q-action-btn ' + (isFav ? 'favorited' : '') + '" onclick="Wrong.toggleFav(\'' + q.id + '\')">' +
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="' + (isFav ? 'currentColor' : 'none') + '" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg> ' +
        (isFav ? '已收藏' : '收藏') +
      '</button>' +
      '<button class="q-action-btn" onclick="Wrong.removeItem(\'' + q.id + '\')" style="border-color:var(--success);color:var(--success)">移出错题本</button>' +
    '</div>';

    // Nav
    html += '<div class="q-nav">';
    html += _detailIdx > 0 ? '<button class="btn btn-outline" onclick="Wrong.prevDetail()">上一题</button>' : '<div></div>';
    if (_detailIdx < _wrongQs.length - 1) {
      html += '<button class="btn btn-primary" onclick="Wrong.nextDetail()">下一题</button>';
    } else {
      html += '<button class="btn btn-outline" onclick="Wrong.backToList()">返回列表</button>';
    }
    html += '</div></div>';

    container.innerHTML = html;
  }

  async function selectOpt(qId, letter) {
    var q = App.getQuestionById(qId);
    if (!q || _revealed[qId]) return;
    if (q.type === 'multiple') {
      var sel = _answered[qId] || [];
      var idx = sel.indexOf(letter);
      if (idx === -1) sel.push(letter); else sel.splice(idx, 1);
      sel.sort();
      _answered[qId] = sel;
    } else {
      _answered[qId] = letter;
      _revealed[qId] = true;
      // Check if correct
      if (letter === q.answer) await Storage.removeWrong(qId);
    }
    _renderDetail();
  }

  async function confirmAns(qId) {
    _revealed[qId] = true;
    var q = App.getQuestionById(qId);
    var userAns = _answered[qId];
    if (q && Array.isArray(userAns) && userAns.join('') === q.answer) {
      await Storage.removeWrong(qId);
    }
    _renderDetail();
  }

  function revealEssay(qId) {
    _revealed[qId] = true;
    _renderDetail();
  }

  async function toggleFav(qId) {
    var added = await Storage.toggleFavorite(qId);
    App.toast(added ? '已收藏' : '已取消收藏');
    _renderDetail();
  }

  async function removeItem(qId) {
    await Storage.removeWrong(qId);
    App.toast('已移出错题本');
    _wrongQs = _wrongQs.filter(function(q) { return q.id !== qId; });
    if (_wrongQs.length === 0 || _detailIdx >= _wrongQs.length) {
      backToList();
    } else {
      _renderDetail();
    }
  }

  function prevDetail() { if (_detailIdx > 0) { _detailIdx--; _renderDetail(); document.getElementById('mainContent').scrollTop = 0; } }
  function nextDetail() { if (_detailIdx < _wrongQs.length - 1) { _detailIdx++; _renderDetail(); document.getElementById('mainContent').scrollTop = 0; } }

  function backToList() {
    _viewMode = 'list';
    document.getElementById('headerTitle').textContent = '错题本';
    _renderList();
  }

  function practiceAll() {
    if (_wrongQs.length === 0) return;
    _detailIdx = 0;
    _answered = {};
    _revealed = {};
    _viewMode = 'detail';
    _renderDetail();
  }

  function clearAll() {
    App.showModal('清空错题本', '确定要清空所有错题吗？', [
      { text: '取消', cls: 'btn-outline' },
      { text: '确定', cls: 'btn-danger', fn: async function() {
        var ids = Storage.getWrongList();
        for (var i = 0; i < ids.length; i++) {
          await Storage.removeWrong(ids[i]);
        }
        _wrongQs = [];
        _renderList();
        App.toast('已清空错题本');
      }}
    ]);
  }

  return {
    render: render,
    viewDetail: viewDetail,
    selectOpt: selectOpt,
    confirmAns: confirmAns,
    revealEssay: revealEssay,
    toggleFav: toggleFav,
    removeItem: removeItem,
    prevDetail: prevDetail,
    nextDetail: nextDetail,
    backToList: backToList,
    practiceAll: practiceAll,
    clearAll: clearAll
  };
})();
