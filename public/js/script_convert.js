<script>

	function cmdLat2UTM_click(){

        var xy = new Array(2);

        if (isNaN (parseFloat (document.frmConverter.txtLon.value))) {

            alert ("Por favor ingrese una longitud valida.");

            return false;

        }


        lon = parseFloat (document.frmConverter.txtLon.value);



        if ((lon < -180.0) || (180.0 <= lon)) {

            alert ("La longitud ingresada esta fuera de rango.  " +

                   "Por favor ingrese un valor comprendido entre [-180, 180).");

            return false;

        }



        if (isNaN (parseFloat (document.frmConverter.txtLat.value))) {

            alert ("Por favor ingrese una latitud valida.");

            return false;

        }



        lat = parseFloat (document.frmConverter.txtLat.value);



        if ((lat < -90.0) || (90.0 < lat)) {

            alert ("La latitud ingresada esta fuera de rango.  " +

                   "Por favor ingrese un valor comprendido entre [-90, 90].");

            return false;

        }



        // Compute the UTM zone.

        zone = Math.floor ((lon + 180.0) / 6) + 1



        zone = LatLonToUTMXY (DegToRad (lat), DegToRad (lon), zone, xy);



        /* Set the output controls.  */

        document.frmConverter.txtX.value = xy[0];

        document.frmConverter.txtY.value = xy[1];

        document.frmConverter.txtZone.value = zone;

        if (lat < 0)

            // Set the S button.

            document.frmConverter.rbtnHemisphere[1].checked = true;

        else

            // Set the N button.

            document.frmConverter.rbtnHemisphere[0].checked = true;

        return true;

	}



	function cmdUTM2Lat_click(){



        latlon = new Array(2);

        var x, y, zone, southhemi;



        if (isNaN (parseFloat (document.frmConverter.txtX.value))) {

            alert ("Por favor ingrese un valor valido para X.");

            return false;

        }



        x = parseFloat (document.frmConverter.txtX.value);



        if (isNaN (parseFloat (document.frmConverter.txtY.value))) {

            alert ("Por favor ingrese un valor valido para Y.");

            return false;

        }



        y = parseFloat (document.frmConverter.txtY.value);



        if (isNaN (parseInt (document.frmConverter.txtZone.value))) {

            alert ("Por favor ingrese una zona valida de UTM.");

            return false;

        }



        zone = parseFloat (document.frmConverter.txtZone.value);



        if ((zone < 1) || (60 < zone)) {

            alert ("El valor de zona de UTM esta fuera de rango.  " +

                   "Por favor ingrese un valor entre [1, 60].");

            return false;

        }



        if (document.frmConverter.rbtnHemisphere[1].checked == true)

            southhemi = true;

        else

            southhemi = false;



        UTMXYToLatLon (x, y, zone, southhemi, latlon);



        document.frmConverter.txtLon.value = RadToDeg (latlon[1]);

        document.frmConverter.txtLat.value = RadToDeg (latlon[0]);



        return true;


	}


</script>
