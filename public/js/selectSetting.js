//$(document).ready(function(){ 
    // Create map

/*----Variables----*/
var map, fault, inBounds, bounds, circle, square, labelCenter, circleBound, v; 
var faultSelectCircle = new L.FeatureGroup({zIndex: 900});
var drawnCircle = new L.FeatureGroup({zIndex: 800});

//-----------------------------options for controls 
var typeOfSelect = 'all';
var valorRadio = $('#s').val();
var selMagn = $('#seleMag').val();

$(".nav-tabs a").on('click',function(){
            $(this).tab('show');
});

$('input[type=radio][name=lista-fault]').change(function(){
    if(this.value == '1'){
        typeOfSelect = 'all';         //on map
        $('.uno').css('display','none');
        drawnCircle.clearLayers();
        faultSelectCircle.clearLayers();
        }else if(this.value == '2'){
        typeOfSelect = 'circle';         //on circle
        $('.uno').css('display','inherit');  
            drawnGem(map.getCenter(),valorRadio);
            inBounds = []; 
            listaAndFealtureSelected();
        }
});

$('#s').change(function(){
    drawnCircle.clearLayers();
    valorRadio = $(this).val();
    drawnGem(map.getCenter(),valorRadio);
    faultSelectCircle.clearLayers();
    inBounds = []; 
    listaAndFealtureSelected();
});


/*---slider----*/
var outputSpan = $('#spanOutput');
var sliderDiv = $('#slider');
var minim, maxim;
    sliderDiv.slider({
        range: true,
        min: 4,
        max: 8,
        step: 0.1,
        values: [5, 7],
        slide: function (event, ui) {
            outputSpan.html(ui.values[0] + ' - ' + ui.values[1] + ' Units'); 
            minim = ui.values[0];
            maxim = ui.values[1];
            map.removeLayer(fault);
            createGeoJson(selMagn,minim,maxim);
            console.log(minim+'   '+ maxim);
        },
    });

minim =sliderDiv.slider('values', 0);
maxim = sliderDiv.slider('values', 1);

outputSpan.html( minim + ' - ' + maxim + ' Mw');

sliderDiv.change(function(){
    console.log(sliderDiv.slider('values', 0)+'--'+sliderDiv.slider('values', 1));
})

/*----*/

function radioKm(r){
    return r*1000;
}

function drawnGem(b,rad){
        var newRadio = radioKm(rad);
        
        circle = L.circle(b, newRadio, {
           color: 'rgba(255,0,0,1)',
           fillOpacity: 0,
           weight: 1,
           dashArray: '3'
        }).addTo(map);
        circleBound = circle.getBounds();
        square = L.rectangle(circleBound,{
            color: 'rgb(0,0,0)',
            opacity: 1,
            fillOpacity: 0,
            weight: 0.5,
            dashArray: '5'
        }).addTo(map);
          
        labelCenter = new L.marker(b, {
            icon: L.divIcon({
                    className: 'labelCircle',
                    html:" "
                         })
        }).addTo(map);
    
        
    
        drawnCircle.addLayer(circle);
        drawnCircle.addLayer(square);
        drawnCircle.addLayer(labelCenter);
          
        map.addLayer(drawnCircle);
}

/*---------------------------------*/
    map = new L.map('map',{
        zoomControl: false,
        maxZoom: 28,
        minZoom: 6
    }).setView([37.6710, -1.6982], 10);
    // Create scale bar  
   var scale = new L.control.scale({maxWidth:240, metric:true, imperial:false, position: 'bottomleft'}).addTo(map);
    
    // Create mapbase with OpenStreetMap
    var osm = new L.tileLayer('http://{s}.tile.osm.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="http://openstreetmap.org">OpenStreetMap</a>'
    }).addTo(map);   
     


    function style_Fault(feature){
        return{
                    opacity: 1,
                    color: 'rgba(30,60,111,1)',
                    lineCap: 'butt',
                    lineJoin: 'miter',
                    weight: 3
                }
    };

    function style_FaultSelect(feature){
        return {
					color:  'rgb(255,40,199)',
                    weight: 8,
					opacity: 1
                }
    };

var newDataFault = [];
for(var i=0; i < excelDF.length; i++ ){
    newDataFault.push(excelDF[i].ID);
};

var idText, FaultName, SegmentNam, LocationX, LocationY, Dip, Strike, SenseOfMov, Length, Ztop, Width, Area, NetSlipRat, Magnit;

/*--add new casos--*/
var casos = 'High Probability';
var casoValue = 0;
$('#seleCaso', window.parent.document).change(function(){
    switch($(this).val()){
        case 'caso1': casos = 'High Probabilit';
            casoValue = 0;
            break;   
        case 'caso2': casos = 'Low Probability (High Impact)';
            casoValue = 1;
            break;
        case 'caso3': casos = 'Very Low Probability (Very High Impact)';
            casoValue = 2;
            break;
           }
});


/*--¿¿¿¿¿¿¿¿¿¿¿¿¿¿¿¿¿¿¿¿¿¿¿¿¿¿¿¿¿WHAT FOR??????????????????????????????--*/
function createGeoJson(x,mn,mx){
    fault = new L.geoJSON(fault_mini,{
        style: style_Fault,
        onEachFeature: function(feature, layer){
            var id = feature.properties.ID_1.toString(); /*from fault_mini*/
            var sMov = feature.properties.SensOfMov.toString(); /*it is field in fault_mini which is abreviation of fochal mechanism.*/
            var mag = feature.properties.MaxMagnitu.toFixed(1);/*from fault_mini*/
            var nameFaul = feature.properties.FaultName.toString();/*from fault_mini*/
            var index;
            index = newDataFault.indexOf(id);
             var now = '', pop;
            layer.on('click', function(e){
            
                $('a#download-data').removeClass('disabled');
                
                idText = "'"+excelDF[index].ID+"'";
                FaultName = "'"+excelDF[index]['FaultName']+"'";
                SegmentNam = "'"+excelDF[index]['SegmentNam']+"'";
                LocationX = excelDF[index]['LocationX'];
                LocationY = excelDF[index]['LocationY'];
                Magnit = mag;
                Dip = excelDF[index]['Dip'];
                Strike = excelDF[index]['Strike'];
                //SenseOfMov = "'"+excelDF[index]['FocalMechanism']+"'";
                SenseOfMov = excelDF[index]['FocalMechanism'];
                Length = excelDF[index]['L'];
                Ztop = excelDF[index]['Ztop'];
                Width = excelDF[index]['W'];
                Area = excelDF[index]['Area'];
                NetSlipRat = excelDF[index]['NetSlipRate'];

                
                pop = L.popup().setLatLng(e.latlng)
                              .setContent("<strong>ID: </strong>"+id+'<br><strong>Name: </strong>'+nameFaul+'<br><strong>Focal Mechanism: </strong>'+sMov+'<br><strong>Magnitude: </strong>'+mag+'<br><strong>Z<sub>tor</sub>: </strong>'+Ztop+'<br><strong>Strike: </strong>'+Strike+'<br><strong>Dip: </strong>'+Dip+'<br><br><a id="download-data" href="javascript:showTextWarning('+"'"+'automatic'+"'"+')" class="btn btn-success" > Generate Max Magnitude </a>')
                               .openOn(map); 

            });
            
            layer.on('mouseover', function () {
                this.setStyle(style_FaultSelect());
            });
            
            layer.on('mouseout', function () {
                fault.resetStyle(this);
            });

        },
        zIndex: 650,
        filter: function(feature){
            switch(x){

              case 'All': return feature.properties.ID_1 != undefined && feature.properties.MaxMagnitu >= mn && feature.properties.MaxMagnitu < mx;
                  break;
              case 'Normal': return feature.properties.SensOfMov == 'Normal' && feature.properties.MaxMagnitu >= mn && feature.properties.MaxMagnitu < mx;
                  break;
              case 'Reverse': return feature.properties.SensOfMov == 'Reverse' && feature.properties.MaxMagnitu >= mn && feature.properties.MaxMagnitu < mx;
                  break;
              case 'StrikeSlip': return feature.properties.SensOfMov == 'StrikeSlip' && feature.properties.MaxMagnitu >= mn && feature.properties.MaxMagnitu < mx;
                  break;
                 }
        }
    }).addTo(map);    
}

    createGeoJson(selMagn,minim,maxim);
    map.fitBounds(fault.getBounds(), {animation:true})
                .setMaxBounds(fault.getBounds().pad(0.5));



$('#seleMag').change(function(){
    selMagn = $(this).val();
    map.removeLayer(fault);
    createGeoJson(selMagn,minim,maxim);
    if(selMagn == 'All'){
       map.fitBounds(fault.getBounds(), {animation:true});
       }
})

/*---------------------*/

    map.on('move', function () {
        
      map.addLayer(drawnCircle); 
      map.addLayer(faultSelectCircle); 
      drawnCircle.clearLayers();
      faultSelectCircle.clearLayers();
      inBounds = [];   
      if(typeOfSelect == 'all'){
          
          listaAndFealtureAll();
          
      }else{
          
        drawnGem(map.getCenter(),valorRadio);
        listaAndFealtureSelected(); 

         }
    });


function listaAndFealtureAll(){
            bounds = map.getBounds();
         fault.eachLayer(function(m) {
            if (bounds.contains(m.getBounds().getCenter())) {
                var idpar = m.feature.properties.ID_1.toString();
                var nameFaul = m.feature.properties.FaultName.toString();
                inBounds.push('<li id="faul-all" class="list-group-item" data-falla="'+idpar+'">'+nameFaul+' - '+idpar+'</li>');
            };
         });
          
         inBounds.sort();
          $('#list-group').html(inBounds.join('\n'));
      
           selectFromList('li#faul-all');
        
}

function listaAndFealtureSelected(){
           fault.eachLayer(function(m) { 
              if (circleBound.contains(m.getBounds().getCenter())) {
                v = L.geoJSON(m.feature,{
                    style: {
                        color: 'rgb(255,40,199)',
                        lineCap: 'butt',
                        lineJoin: 'miter',
                        width: 4,
                        opacity: 1
                    },
                    onEachFeature: function(f,l){
                        var id = f.properties.ID_1.toString();
                        var sMov = f.properties.SensOfMov.toString();
                        var mag = f.properties.MaxMagnitu.toFixed(1);
                        var nameFaul = f.properties.FaultName.toString();
                        var index, pop;
                        index = newDataFault.indexOf(id);
                        var now= '';
                        l.on('mouseover', function () {
                            this.setStyle(style_FaultSelect());
                            
                        });

                        l.on('mouseout', function () {
                            v.resetStyle(this);
                        });
                        
                       l.on('click', function(e){
            
                        $('a#download-data').removeClass('disabled');

             
                    idText = "'"+excelDF[index].ID+"'";
                    FaultName = "'"+excelDF[index]['FaultName']+"'";
                    SegmentNam = "'"+excelDF[index]['SegmentNam']+"'";
                    LocationX = excelDF[index]['LocationX'];
                    LocationY = excelDF[index]['LocationY'];
                    Magnit = mag;
                    Dip = excelDF[index]['Dip'];
                    Strike = excelDF[index]['Strike'];
                    //SenseOfMov = "'"+excelDF[index]['FocalMechanism']+"'";
                    SenseOfMov = excelDF[index]['FocalMechanism'];
                    Length = excelDF[index]['L'];
                    Ztop = excelDF[index]['Ztop'];
                    Width = excelDF[index]['W'];
                    Area = excelDF[index]['Area'];
                    NetSlipRat = excelDF[index]['NetSlipRate'];
                           
                           
                    pop = L.popup().setLatLng(e.latlng)
                              .setContent("<strong>ID: </strong>"+id+'<br><strong>Name: </strong>'+nameFaul+'<br><strong>Focal Mechanism: </strong>'+sMov+'<br><strong>Magnitude: </strong>'+mag+'<br><strong>Z<sub>tor</sub>: </strong>'+Ztop+'<br><strong>Strike: </strong>'+Strike+'<br><strong>Dip: </strong>'+Dip+'<br><br><a id="download-data" href="javascript:showTextWarning('+"'"+'automatic'+"'"+')" class="btn btn-success" > Generate Max Magnitude </a>')
                               .openOn(map); 

                        });

                    }
                });
                faultSelectCircle.addLayer(v);
                var idpar = m.feature.properties.ID_1.toString();
                var nameFaul = m.feature.properties.FaultName.toString();
                inBounds.push('<li id="faul-circle" class="list-group-item" data-falla="'+idpar+'">'+nameFaul+' - '+idpar+'</li>');  
                  
               }
         });
              
        inBounds.sort();
        $('#list-group').html(inBounds.join('\n'));

        selectFromList('li#faul-circle'); 
};
var conteo = 0; 
function selectFromList(a){
        $(a).on('mouseover',function(){
                  if(conteo == 0){
                     
              var n = $(this).data('falla');
              fault.eachLayer(function(e){
                  if(e.feature.properties.ID_1 == n){
                      e.setStyle(style_FaultSelect());
                     }else{
                      e.setStyle(style_Fault());
                     }
              });
                      
                     }
          
              });
    
        $(a).on('click',function(){
            conteo = 1;
            var m = $(this).data('falla');
            $('#faulSelected').val($(this).html());
                  fault.eachLayer(function(e){
                      if(e.feature.properties.ID_1 == m){
                         e.setStyle(style_FaultSelect());                    
                          $('#faulSelected-go').on('click',function(){
                             conteo = 0;
                             map.fitBounds(e.getBounds(), 13,{
                                  padding: [50,50],
                                  animation: true
                              });
                          })
                         }else{
                            e.setStyle(style_Fault());
                            //conteo = 0;
                     }
                  });
              })
};


/**-------------------------------------**/
var rangeSlider = $('#sliderCreate');
var rangeSliderDip = $('#sliderCreate-dip');
var mapActive = false;
var angleDip = 45 ;
var latLot, xyUTM,mag, Ld, azimut;
var joinLayer = new L.FeatureGroup();

var LocationXC, LocationYC, MagnitC,  DipC, SenseOfMovC, LengthC, ZtopC, WidthC, StrikeC;
DipC = 45;

$('#star').on('click', function(){
    //-----------button star
    $(this).addClass('disabled');
    $('#end').removeClass('disabled');

    $("#map").css("cursor","crosshair");
    
    mapActive = true;
   
});


$('#end').on('click', function(){

  // UI reset
  $(this).addClass('disabled');
  $('#star').removeClass('disabled');
  $('#view-map').addClass('disabled');
  $("#map").css("cursor","inherit");

  $('#l-distancia').attr('disabled','true');
  $('#input-Ztop').attr('disabled','true');
  $('#Focal').attr('disabled','true');

  $('#xy-coordenadas').val('');
  $('#l-distancia').val('5.0');
  $('#input-Ztop').val('5');
  $('#Focal').val('SS');

  rangeSlider.slider({disabled:true, value:45});
  rangeSliderDip.slider({disabled:true, value:45});

  $('.createSlider label span').html(45);
  $('.createSlider-dip label span').html(45);

  joinLayer.clearLayers();
  mapActive = false;

  //  RESET REAL DE DATOS DE TERREMOTO
  LocationX = null;
  LocationY = null;
  Magnit = null;
  Dip = null;
  Strike = null;
  SenseOfMov = null;
  Length = null;
  Ztop = null;
  Width = null;
  Area = null;
  NetSlipRat = null;
  idText = null;
  FaultName = null;
  SegmentNam = null;

  // También para el modo manual
  LocationXC = null;
  LocationYC = null;
  MagnitC = null;
  DipC = 45;
  StrikeC = null;
  LengthC = null;
  WidthC = null;

  // LIMPIAR cache global si existe
  window.lastEarthquakeParams = null;

});


$('#l-distancia').change(function(){
    
    joinLayer.clearLayers();
    
    mag = $(this).val();
    MagnitC = $(this).val();
    rangeSlider.slider({
            slide: function (event, ui) {
            joinLayer.clearLayers();
            $('.createSlider label span').html(ui.value.toFixed(0));
            mag = $('#l-distancia').val();
            azimut = ui.value;
            Len = 1000*(Math.sqrt( 1.5 * ( Math.pow(10, mag-3.82) ) ));
            createFault(latLot, Len, azimut);
             //to textfile   
            StrikeC = ui.value;
            MagnitC =$('#l-distancia').val();
            LengthC = 1000*(Math.sqrt( 1.5 * ( Math.pow(10, mag-3.82) ) ));
                
        }
    });
    
    Len = 1000*(Math.sqrt( 1.5 * ( Math.pow(10, mag-3.82) ) ));
    LengthC = 1000*(Math.sqrt( 1.5 * ( Math.pow(10, mag-3.82) ) ));
    createFault(latLot, Len, azimut);
    
});


map.on('click', function(e){
    
    if(mapActive){
       
    //open input
    $('#l-distancia').removeAttr('disabled');
    $('#input-Ztop').removeAttr('disabled');
    $('#Focal').removeAttr('disabled');
    $('#view-map').removeClass('disabled');
        
    rangeSlider.slider({disabled:false});
    rangeSliderDip.slider({disabled:false});

    joinLayer.clearLayers();
    
    latLot = e.latlng;    // degrees
    azimut = $('#sliderCreate').slider('value');
    mag = $('#l-distancia').val();
    Len = 1000*(Math.sqrt( 1.5 * ( Math.pow(10, mag-3.82) ) ));
    createFault(latLot, Len, azimut);
         //to textfile
    StrikeC = $('#sliderCreate').slider('value');
    MagnitC =$('#l-distancia').val();
    LengthC = 1000*(Math.sqrt( 1.5 * ( Math.pow(10, mag-3.82) ) ));
   }
    
});


function calculateSecondCoord (a, l, az){
    var L = l;//meter
    var alfa = az; // degrees
    var SenAlfa, CosAlfa, x_add, y_add, xnew, ynew;
    var SenAlfaDip, CosAlfaDip, x_addDip, y_addDip, xnewDip, ynewDip;
    
    WidthC = (2/3)*L;
    w = (2/3)*L;
    WL = w*Math.cos(DegToRad(angleDip));
    
    if(alfa >= 0 && alfa < 90){
        SenAlfa = Math.sin(DegToRad(alfa)) ; // rad
        CosAlfa = Math.cos(DegToRad(alfa)) ; // rad
        x_add = L * SenAlfa;
        y_add = L * CosAlfa;
        xnew = a.utmx + x_add;
        ynew = a.utmy + y_add;
        //-------dip
        SenAlfaDip = Math.sin(DegToRad(alfa)) ; // rad
        CosAlfaDip = Math.cos(DegToRad(alfa)) ; // rad
        x_addDip = WL * CosAlfaDip;
        y_addDip = WL * SenAlfaDip;
        xnewDip = a.utmx + x_addDip;
        ynewDip = a.utmy - y_addDip; 
        
    }else if(alfa >= 90 && alfa < 180){
        SenAlfa = Math.sin(DegToRad(-90 + alfa)) ; // rad
        CosAlfa = Math.cos(DegToRad(-90 + alfa)) ; // rad
        x_add = L * CosAlfa;
        y_add = L * SenAlfa;
        xnew = a.utmx + x_add;
        ynew = a.utmy - y_add;
        //-------dip
        SenAlfaDip = Math.sin(DegToRad(180 - alfa)) ; // rad
        CosAlfaDip = Math.cos(DegToRad(180 - alfa)) ; // rad
        x_addDip = WL * CosAlfaDip;
        y_addDip = WL * SenAlfaDip;
        xnewDip = a.utmx - x_addDip;
        ynewDip = a.utmy - y_addDip; 
        
    }else if(alfa >= 180 && alfa < 270){
        SenAlfa = Math.sin(DegToRad(-180 + alfa)) ; // rad
        CosAlfa = Math.cos(DegToRad(-180 + alfa)) ; // rad
        x_add = L * SenAlfa;
        y_add = L * CosAlfa;
        xnew = a.utmx - x_add;
        ynew = a.utmy - y_add;
        //-------------dip
        SenAlfaDip = Math.sin(DegToRad(270 - alfa)) ; // rad
        CosAlfaDip = Math.cos(DegToRad(270 - alfa)) ; // rad
        x_addDip = WL * SenAlfaDip;
        y_addDip = WL * CosAlfaDip;
        xnewDip = a.utmx - x_addDip;
        ynewDip = a.utmy + y_addDip;
        
    }else if(alfa >= 270 && alfa < 360){
        SenAlfa = Math.sin(DegToRad(-270 + alfa)) ; // rad
        CosAlfa = Math.cos(DegToRad(-270 + alfa)) ; // rad
        x_add = L * CosAlfa;
        y_add = L * SenAlfa;
        xnew = a.utmx - x_add;
        ynew = a.utmy + y_add;
        //------------dip
        SenAlfaDip = Math.sin(DegToRad(360-alfa)) ; // rad
        CosAlfaDip = Math.cos(DegToRad(360-alfa)) ; // rad
        x_addDip = WL * CosAlfaDip;
        y_addDip = WL * SenAlfaDip;
        xnewDip = a.utmx + x_addDip;
        ynewDip = a.utmy + y_addDip;
    }

    return {xnew, ynew, xnewDip, ynewDip}
}

 var  layLineDip, layPointEndDip  ;

function createGeometry(lat, long, latTwo, longTwo, latDip, lngDip){

    var geojsonMarkerOptions = {
        radius: 4,
        fillColor: "#000",
        fillOpacity: 1,
        color: "#000",
        weight: 1,
        opacity: 1,
    };

    var LineDip = [{
        "type": "LineString",
        "coordinates": [[long, lat], [lngDip, latDip]]
    }];
    
    var PointEndDip= [{
        "type": "Point",
        "coordinates": [lngDip, latDip]
    }];
    
     layLineDip = new  L.geoJSON(LineDip,{
        style:{
            color: "rgba(244,0,0,1)",
            opacity:1,
            weight: 3,
        }
    });
    
     layPointEndDip = new L.geoJSON(PointEndDip,{
        pointToLayer: function (feature, latlng) {
        return new L.Marker(latlng, {
            icon: L.divIcon({
                    className: 'labelTriangleDip',
                    html:"<div class='labelFleDip' ><div>"
                         })
        })
        }
    });
    
    
    var PointStar = [{
        "type": "Point",
        "coordinates": [long, lat]
    }];
    
     var PointEnd= [{
        "type": "Point",
        "coordinates": [longTwo, latTwo]
    }];
    
    
   var layPointStar = new L.geoJSON(PointStar,{
        pointToLayer: function (feature, latlng) {
        return L.circleMarker(latlng, geojsonMarkerOptions);
        }
    });
    
    var layPointEnd = new L.geoJSON(PointEnd,{
        pointToLayer: function (feature, latlng) {
        return new L.Marker(latlng, {
            icon: L.divIcon({
                    className: 'labelTriangle',
                    html:"<div class='labelFle' ><div>"
                         })
        })
        }
    });
    
    var Line = [{
        "type": "LineString",
        "coordinates": [[long, lat], [longTwo, latTwo]]
    }];
    
    var layLine = new  L.geoJSON(Line,{
        style:{
             color: "#000",
            weight: 3,
        }
    });
    
    
    joinLayer.addLayer(layLineDip);
    joinLayer.addLayer(layPointEndDip);
    joinLayer.addLayer(layPointStar);
    joinLayer.addLayer(layPointEnd);
    joinLayer.addLayer(layLine);
    map.addLayer(joinLayer);
    
}


function createFault(lati_long, dist, angulo ){
    // radianes
    var phi_rad = DegToRad(lati_long.lat);
    var lng_rad = DegToRad(lati_long.lng);
    //console.log(lati_long.lat+' - '+lati_long.lng);
    var hemisferio;
    if (lati_long.lat > 0){
        hemisferio = false;
    }else{
        hemisferio = true;
    }
    var arco = ArcLengthOfMeridian (lati_long.lat);
    
    var zone = Math.floor ((lati_long.lng + 180.0) / 6) + 1 ;
    
    var LamdaCero = UTMCentralMeridian (zone);
    
    var xy = [];
    var MapLatLonToXY_N = MapLatLonToXY (phi_rad, lng_rad, LamdaCero, xy);
    
    var xyUTM = LatLonToUTMXY (phi_rad, lng_rad, zone, MapLatLonToXY_N);
    //console.log(xyUTM);
    $('#xy-coordenadas').val(lati_long.lat.toFixed(5) + '  ;  '+lati_long.lng.toFixed(5));
   // $('#l-w').val("L: "+ dist + ' ; '+"W: "+dist*0.5);
    LocationXC = lati_long.lng.toFixed(5);
    LocationYC = lati_long.lat.toFixed(5);
    
    var new_xy = calculateSecondCoord (xyUTM, dist, angulo);
    //console.log(new_xy);
    
    var llnew = [];
    var llnewDip = [];
    var UTMtoLL = UTMXYToLatLon (new_xy.xnew, new_xy.ynew, zone, false, llnew);
    var UTMtoLLDip = UTMXYToLatLon (new_xy.xnewDip, new_xy.ynewDip, zone, false, llnewDip);
    
    llnew[0] = RadToDeg(llnew[0]);
    llnew[1] = RadToDeg(llnew[1]);
    llnewDip[0] = RadToDeg(llnewDip[0]);
    llnewDip[1] = RadToDeg(llnewDip[1]);
    //console.log(llnew);
    //console.log(llnewDip);
    
    createGeometry( lati_long.lat, lati_long.lng, llnew[0], llnew[1], llnewDip[0], llnewDip[1] );
    
    $('.labelFle').css({
      '-webkit-transform' : 'rotate('+angulo+'deg)',
      '-moz-transform'    : 'rotate('+angulo+'deg)',
      '-ms-transform'     : 'rotate('+angulo+'deg)',
      '-o-transform'      : 'rotate('+angulo+'deg)',
      'transform'         : 'rotate('+angulo+'deg)'
    });
    var anguloDip = angulo+90;
    $('.labelFleDip').css({
      '-webkit-transform' : 'rotate('+anguloDip+'deg)',
      '-moz-transform'    : 'rotate('+anguloDip+'deg)',
      '-ms-transform'     : 'rotate('+anguloDip+'deg)',
      '-o-transform'      : 'rotate('+anguloDip+'deg)',
      'transform'         : 'rotate('+anguloDip+'deg)'
    });
    
}




//var rangeSlider = $('#sliderCreate-dip');
    rangeSlider.slider({
        disabled:true,
        range: false,
        min: 0,
        max: 359,
        step: 1,
        value: 45,
        slide: function (event, ui) {
            //console.log(ui.values[0]);
            joinLayer.clearLayers();
            $('.createSlider label span').html(ui.value.toFixed(0));
            mag = $('#l-distancia').val();
            azimut = ui.value;
            Len = 1000*(Math.sqrt( 1.5 * ( Math.pow(10, mag-3.82) ) ));
            createFault(latLot, Len, azimut);
            //to textfile
            StrikeC = ui.value;
            MagnitC =$('#l-distancia').val();
            LengthC = 1000*(Math.sqrt( 1.5 * ( Math.pow(10, mag-3.82) ) ));
        },
    });



//var rangeSlider = $('#sliderCreate-dip');
    rangeSliderDip.slider({
        disabled:true,
        range: false,
        min: 0,
        max: 89,
        step: 1,
        value: 45,
        slide: function (event, ui) {
            $('.createSlider-dip label span').html(ui.value.toFixed(0));
            angleDip = ui.value;
            DipC = ui.value;
            //console.log(ui.values[0]);
        },
    });

/***********---------------------------------------****************/

    SenseOfMovC = $('#Focal').val();
$('#Focal').change(function(){
    SenseOfMovC = $(this).val();
});
    ZtopC = $('#input-Ztop').val();
$('#input-Ztop').change(function(){
    ZtopC = $(this).val();
});


$("li#view-map").on('click',function(){

    showTextWarning('manual');
});

var buffer = undefined;


function createFile(buffer,casoValue,lat,lng,mag,strike,dip,fm,length,ztop,width,id,fn,sn,area,NetSlipRat){

    $('.modal', window.parent.document).css('display','inherit');
    $('.warnigOption', window.parent.document).css('display','none');
    $('.divLoadData', window.parent.document).css('display','inherit');
    
    //$('body', window.parent.document).css('overflow', 'hidden');
    
    id = (id != null) ? id : '';
    fn = (fn != null) ? fn : '';
    sn = (sn != null) ? sn : '';
    area = (area != null) ? area : '';
    NetSlipRat = (NetSlipRat != null) ? NetSlipRat : '';
			$.ajax('/createData', {
				data: {
                    buffer: buffer,
					lat: lat,
					lng: lng,
					Mag: mag,
                    Strike: strike,
                    Dip: dip,
                    FM: fm,
                    Length: length,
                    Ztop: ztop,
                    Width: width,
                    Id: id,
                    FN: fn,
                    SN: sn,
                    Area: area,
                    NetSlipRat: NetSlipRat,
                    caseValue: casoValue,
				},
                success: function (data) {
					if(data){
                       $('.modal', window.parent.document).css('display','none');
                       $('.warnigOption', window.parent.document).css('display','inherit');
                       $('.divLoadData', window.parent.document).css('display','none');
                       //$('body', window.parent.document).css('overflow', 'auto');
                        
                       $('a#mapView', window.parent.document).css('display','inline-block');
                       $('a#home-btn', window.parent.document).css('display','inline-block');
                       
                    }
                     console.log(data);
				},
                error: function (xhr) {
                    $('.modal', window.parent.document).css('display','none');
                    $('.divLoadData', window.parent.document).css('display','none');
                    $('.warnigOption', window.parent.document).css('display','inherit');
                    var msg;
                    if (xhr.status === 400) {
                        try {
                            var resp = JSON.parse(xhr.responseText);
                            msg = resp.userError || xhr.responseText;
                        } catch(e) { msg = xhr.responseText; }
                    } else {
                        msg = 'An unexpected server error occurred. Please try again.';
                    }
                    $('p#warningMsg', window.parent.document).html(
                        '<span style="color:#c0392b;font-weight:bold;">&#9888; ' +
                        msg.replace(/\n/g, '<br>') +
                        '</span>'
                    );
                       // Error de distancia: ocultar Cancel (warningNo), warningOk ya dice Accept
                    $('a#warningNo', window.parent.document).css('display','none');
                    $('li#warningOk', window.parent.document).off('click').on('click', function(){
                        window.parent.closeModal();
                        $('a#warningNo', window.parent.document).css('display','');
                    });
                    $('.modal', window.parent.document).css('display','inherit');
                    console.error('[createFile] Error del servidor:', xhr.status, msg);
                }
			});
		return true;
}



var textWarning = '';

function showTextWarning(t){

    $('.modal', window.parent.document).css('display','inherit');
    var clickOK = $('li#warningOk', window.parent.document);

    fetch('/me').then(function(r){ return r.json(); }).then(function(d){
        var isLogged = !!d.usuario;

        if(t == 'automatic'){

            textWarning = 'Do you want to generate maximum magnitude <strong>'+Magnit+'</strong> on fault <strong>'+idText+'</strong> to calculate the seismic risk with <strong>'+casos+'</strong>?';
            $('p#warningMsg', window.parent.document).html(textWarning);

            clickOK.off("click");
            clickOK.click(function(){

                $("#warnigOption", window.parent.document).css('display','none');

                if (isLogged) {

                    $("#ByfferMssgOption", window.parent.document).css('display','inherit');
                    $('li#WithBuffer', window.parent.document).off('click');
                    $('li#WithBuffer', window.parent.document).on('click',function(){

                        buffer = "wb";

                        // ✅ SIEMPRE datos actuales
                        createFile(buffer,casoValue,LocationY,LocationX,Magnit,Strike,Dip,SenseOfMov.toString(),Length,Ztop,Width,idText,FaultName,SegmentNam,Area,NetSlipRat);

                        $("#ByfferMssgOption", window.parent.document).css('display','none');
                        $('a#viewBuffer', window.parent.document).css('display','inline-block');
                    });

                    $('li#WithOutBuffer', window.parent.document).off('click');
                    $('li#WithOutBuffer', window.parent.document).on('click',function(){

                        buffer = "wob";
                        createFile(buffer,casoValue,LocationY,LocationX,Magnit,Strike,Dip,SenseOfMov.toString(),Length,Ztop,Width,idText,FaultName,SegmentNam,Area,NetSlipRat);
                        $("#ByfferMssgOption", window.parent.document).css('display','none');
                        $('a#viewBuffer', window.parent.document).css('display','none');
                    });

                } else {
                    buffer = "wob";
                    $('a#viewBuffer', window.parent.document).css('display','none');
                    createFile(buffer,casoValue,LocationY,LocationX,Magnit,Strike,Dip,SenseOfMov.toString(),Length,Ztop,Width,idText,FaultName,SegmentNam,Area,NetSlipRat);
                }
            });

        } else if(t == 'manual'){

            textWarning = 'Do you want to generate a magnitude <strong>'+MagnitC+'</strong> on a manualy given fault to calculate the seismic risk with <strong>'+casos+'</strong>?';
            $('p#warningMsg', window.parent.document).html(textWarning);

            clickOK.off("click");
            clickOK.click(function(){

                $("#warnigOption", window.parent.document).css('display','none');

                if (isLogged) {

                    $("#ByfferMssgOption", window.parent.document).css('display','inherit');

                    $('li#WithBuffer', window.parent.document).off('click');
                    $('li#WithBuffer', window.parent.document).on('click',function(){

                        buffer = "wb";

                        LengthC = (LengthC/1000).toFixed(4);
                        WidthC = (WidthC/1000).toFixed(4);

                        createFile(buffer,casoValue,LocationYC,LocationXC,MagnitC,StrikeC,DipC,SenseOfMovC,LengthC,ZtopC,WidthC);

                        $("#ByfferMssgOption", window.parent.document).css('display','none');
                        $('a#viewBuffer', window.parent.document).css('display','inline-block');
                    });

                    $('li#WithOutBuffer', window.parent.document).off('click');
                    $('li#WithOutBuffer', window.parent.document).on('click',function(){

                        buffer = "wob";

                        LengthC = (LengthC/1000).toFixed(4);
                        WidthC = (WidthC/1000).toFixed(4);

                        createFile(buffer,casoValue,LocationYC,LocationXC,MagnitC,StrikeC,DipC,SenseOfMovC,LengthC,ZtopC,WidthC);

                        $("#ByfferMssgOption", window.parent.document).css('display','none');
                        $('a#viewBuffer', window.parent.document).css('display','none');
                    });

                } else {

                    buffer = "wob";

                    LengthC = (LengthC/1000).toFixed(4);
                    WidthC = (WidthC/1000).toFixed(4);

                    $('a#viewBuffer', window.parent.document).css('display','none');

                    createFile(buffer,casoValue,LocationYC,LocationXC,MagnitC,StrikeC,DipC,SenseOfMovC,LengthC,ZtopC,WidthC);
                }
            });
        }

    }).catch(function(){
        console.warn('No se pudo verificar sesion, asumiendo usuario sin login');
    });
}




/*--------------*/

var options = {
            position: 'topleft',
            lengthUnit: {                 // You can use custom length units. Default unit is kilometers.
                display: 'km',              // This is the display value will be shown on the screen. Example: 'meters'
                decimal: 2,                 // Distance result will be fixed to this value. 
                factor: null                // This value will be used to convert from kilometers. Example: 1000 (from kilometers to meters)  
            },
        };
L.control.ruler(options).addTo(map);


//});