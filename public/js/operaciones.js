/* $(document).ready(function(){ 
  $.ajax({
    url: "/equipos",
    success: function (equipos) {
      console.log(equipos);
      
    },
    
  });
}); */

function cambioOpciones() {

    var combo = document.getElementById("opciones");
    var opcion = combo.value;
  
    document.getElementById("solucion").value = equipos[opcion][0];
  
    document.getElementById("material").value = opciones[opcion][1];
  
    document.getElementById("tiempo").value = opciones[opcion][2];
  }

