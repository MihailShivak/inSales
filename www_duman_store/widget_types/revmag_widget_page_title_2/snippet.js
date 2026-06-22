$(document).ready(function(){
	$widget.each(function(index, el) {
		let lazyLoad = new LazyLoad({
			container: $(el).get(0),
			elements_selector: '.lazyload'
		});
	});
});