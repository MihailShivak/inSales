$(document).ready(function(){
	$widget.each(function(index, el) {
	  let lazyLoadArticles = new LazyLoad({
	    container: $(el).get(0),
	    elements_selector: '.lazyload'
	  });
	});
});