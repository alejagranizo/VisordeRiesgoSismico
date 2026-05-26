


var outputSpan = $('#spanOutput');
var sliderDiv = $('#slider');

    sliderDiv.slider({
        range: true,
        min: 0,
        max: 10,
        step: 0.5,
        values: [2, 8],
        slide: function (event, ui) {
            outputSpan.html(ui.values[0] + ' - ' + ui.values[1] + ' Units');
        },
   /*     stop: function (event, ui) {
            $('#txtMinAge').val(ui.values[0]);
            $('#txtMaxAge').val(ui.values[1]);
        }*/
    });

    outputSpan.html(sliderDiv.slider('values', 0) + ' - '
        + sliderDiv.slider('values', 1) + ' Units');
    












 /*   $('#txtMinAge').val(sliderDiv.slider('values', 0));
    $('#txtMaxAge').val(sliderDiv.slider('values', 1));*/
    
    
    
   // $('.slider').slider()
 /*   var mySlider = $("input#ex1").slider({
	   formater: function(value) {
		  return value;
            }
        });*/
    
    //var valueD = mySlider.bootstrapSlider('getValue');
   /* var valueD = $("input#ex1").bootstrapSlider();
    var valueX = valueD.bootstrapSlider('getValue');
     $('#valor-range').val(valueX);*/
    