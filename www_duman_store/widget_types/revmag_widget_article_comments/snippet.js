/* Massonry with Grid list */
function resizeMassonryGridItem(item) {
  let grid = document.getElementsByClassName("masonry-reviews-list")[0];
  let rowHeight = parseInt(window.getComputedStyle(grid).getPropertyValue('grid-auto-rows'));
  let rowGap = parseInt(window.getComputedStyle(grid).getPropertyValue('grid-row-gap'));

  if (rowGap == 0) {
    rowGap = 1;
  }

  let rowSpan = Math.ceil((item.querySelector('.masonry-reviews-item__content').getBoundingClientRect().height + rowGap) / (rowHeight + rowGap));

  item.style.gridRowEnd = "span " + rowSpan;
}

function resizeAllMassonryGridItems() {
  const allItems = document.getElementsByClassName("masonry-reviews-item");

  for (let x = 0; x < allItems.length; x++) {
    resizeMassonryGridItem(allItems[x]);
  }
}

window.onload = function() {
  resizeAllMassonryGridItems();
}

window.addEventListener("resize", resizeAllMassonryGridItems);

EventBus.subscribe('widget:input-setting:insales:system:editor', (data) => {
  let masonryReviewsList = document.querySelector('[data-widget-id="' + data.widget_id + '"] .masonry-reviews-list');

  if (masonryReviewsList) {
    resizeAllMassonryGridItems();
  }
});

EventBus.subscribe('widget:change-setting:insales:system:editor', (data) => {
  let masonryReviewsList = document.querySelector('[data-widget-id="' + data.widget_id + '"] .masonry-reviews-list');

  if (masonryReviewsList) {
    resizeAllMassonryGridItems();
  }
});

EventBus.subscribe('send-comment:insales:ui_comments', (success) => {
  let comment_notice_success = $widget.find("[data-comments-form-success]");

  if($widget.find('[data-pseudo-review]').length > 0){
    $widget.find('[data-pseudo-review]').removeClass('hidden');
    resizeAllMassonryGridItems();
  }
});

$('.js-more-items').on("click", function() {
  $(this).parent().find('.masonry-reviews-item.hidden').toggleClass('hidden');
  resizeAllMassonryGridItems();
  $(this).hide();
});

$('.js-show-form').on("click", function() {
  $('.reviews-wrapper').toggleClass('hidden');
  $(this).hide();
});

$('.js-hide-form').on("click", function() {
  $('.reviews-wrapper').toggleClass('hidden');
  $('.js-show-form').show();
});

$widget.find('form input, form textarea').on('keyup', function(){
  if($widget.find('[data-pseudo-review]').length > 0){
    var pseudoReview = $widget.find('[data-pseudo-review]');
    var pseudoName = pseudoReview.find('.author');
    var pseudoComment = pseudoReview.find('.review-content');

    var formName = $widget.find('form [name="comment[author]"]').val();
    var formComment = $widget.find('form [name="comment[content]"]').val();

    pseudoName.html(formName);
    pseudoComment.html(formComment);
  }
});