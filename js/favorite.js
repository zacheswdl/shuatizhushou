/**
 * Favorites Module
 */
var Favorite = (function() {
  var _favQs = [];
  var _detailIdx = 0;
  var _viewMode = 'list';
  var _answered = {};
  var _revealed = {};

  function render() {
    _viewMode = 'list';
    _renderList();
  }

  function _renderList() {
    var container = document.getElementById('pageFavorite');
    var favIds = Storage.getFavorites();

    if (favIds.length === 0) {
      container.innerHTML = '<div class="empty-state">' +
        '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>' +
        '<p>暂无收藏，去练习中收藏题目吧</p></div>';
      return;
    }

    _favQs = favIds.map(function(id) { return App.getQuestionById(id); }).filter(Boolean);

    var html = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">' +
      '<span style="font-size:14px;color:var(--gray-500)">共 ' + _favQs.length + ' 道收藏</span>' +
      '<button class="btn btn-sm btn-outline" onclick="Favorite.practiceAll()">开始复习</button>' +
    '</div>';

    html += '<div class="card" style="padding:4px 16px">';
    _favQs.forEach(function(q, idx) {
      html += '<div class="review-item" onclick="Favorite.viewDetail(' + idx + ')">' +
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
    var container = document.getElementById('pageFavorite');
    var q = _favQs[_detailIdx];
    if (!q) return;

    document.getElementById('headerTitle').textContent = '收藏 (' + (_detailIdx + 1) + '/' + _favQs.length + ')';

    var hasAnswered = _answered.hasOwnProperty(q.id);
    var isRevealed = _revealed[q.id];
    var userAns = _answered[q.id] || (q.type === 'multiple' ? [] : '');

    var html = '<div class="question-card">';
    html += '<div class="q-header"><span class="tag ' + App.getTypeTag(q.type) + '">' + App.getTypeLabel(q.type) + '</span></div>';
    html += '<div class="q-stem">' + App.escHtml(q.question).replace(/\n/g, '<br>') + '</div>';

    if (q.type === 'essay') {
      if (!isRevealed) {
        html += '<button class="btn btn-primary btn-block" onclick="Favorite.revealEssay(\'' + q.id + '\')">查看参考答案</button>';
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
        html += '<div class="' + cls + '" onclick="Favorite.selectOpt(\'' + q.id + '\',\'' + letter + '\')">' +
          '<div class="option-label">' + letter + '</div>' +
          '<div class="option-text">' + App.escHtml(opt.replace(/^[A-E]\.\s*/, '')) + '</div>' +
        '</div>';
      });
      if (!isRevealed && q.type === 'multiple') {
        html += '<button class="btn btn-primary btn-block" onclick="Favorite.confirmAns(\'' + q.id + '\')" ' +
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

    html += '<div class="q-actions">' +
      '<button class="q-action-btn favorited" onclick="Favorite.removeFav(\'' + q.id + '\')">' +
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg> 取消收藏' +
      '</button>' +
    '</div>';

    html += '<div class="q-nav">';
    html += _detailIdx > 0 ? '<button class="btn btn-outline" onclick="Favorite.prevDetail()">上一题</button>' : '<div></div>';
    if (_detailIdx < _favQs.length - 1) {
      html += '<button class="btn btn-primary" onclick="Favorite.nextDetail()">下一题</button>';
    } else {
      html += '<button class="btn btn-outline" onclick="Favorite.backToList()">返回列表</button>';
    }
    html += '</div></div>';

    container.innerHTML = html;
  }

  function selectOpt(qId, letter) {
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
    }
    _renderDetail();
  }

  function confirmAns(qId) {
    _revealed[qId] = true;
    _renderDetail();
  }

  function revealEssay(qId) {
    _revealed[qId] = true;
    _renderDetail();
  }

  async function removeFav(qId) {
    await Storage.toggleFavorite(qId);
    App.toast('已取消收藏');
    _favQs = _favQs.filter(function(q) { return q.id !== qId; });
    if (_favQs.length === 0 || _detailIdx >= _favQs.length) {
      backToList();
    } else {
      _renderDetail();
    }
  }

  function prevDetail() { if (_detailIdx > 0) { _detailIdx--; _renderDetail(); document.getElementById('mainContent').scrollTop = 0; } }
  function nextDetail() { if (_detailIdx < _favQs.length - 1) { _detailIdx++; _renderDetail(); document.getElementById('mainContent').scrollTop = 0; } }

  function backToList() {
    _viewMode = 'list';
    document.getElementById('headerTitle').textContent = '收藏夹';
    _renderList();
  }

  function practiceAll() {
    if (_favQs.length === 0) return;
    _detailIdx = 0;
    _answered = {};
    _revealed = {};
    _viewMode = 'detail';
    _renderDetail();
  }

  return {
    render: render,
    viewDetail: viewDetail,
    selectOpt: selectOpt,
    confirmAns: confirmAns,
    revealEssay: revealEssay,
    removeFav: removeFav,
    prevDetail: prevDetail,
    nextDetail: nextDetail,
    backToList: backToList,
    practiceAll: practiceAll
  };
})();