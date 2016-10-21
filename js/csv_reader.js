/*
    Copyright (C) 2016, Tom Sitter
    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.
    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.
*/

/*
	csvReader is an object that handles the reading and parsing
 	of CSV text files into a useable format 
*/

function readFile(file) {
   
	var parsedData = [];
	console.log('In readFile');
		
	if (!file) {
	   alert("Failed to load file");
	   throw new Error("Failed to load file");
	} else if (!file.type.match(/^text*/) && !file.type.match(/vnd\.ms-excel/g)) {
	    alert(file.name + " is not a valid text or csv file.");
		throw new Error(file.name + " is not a valid text or csv file.");
	} else {
	 	var reader = new FileReader();
	  	reader.onload = (function(file) { 
	  		return function(e) { 
	  			console.log('Reading file');
	    		var contents = e.target.result;
	    		console.log(contents);
	    		parsedData.push(parseToObject($.csv.toArrays(contents)));

				//Check if patient records were found				
				var empty = true;
				for (var i=0; i < parsedData.length; i++) {
					if (parsedData[i]["num_patients"] == 0) {
					 	parsedData.splice(i, 1);
					} else {
						empty = false;
					}
				}
				if (empty) {
					alert("No patient records found in files");
					throw new Error("No patient records found in files");
				}
			};

	 	})(file);
	}
	reader.readAsText(file);
};

/*
 * Takes a raw string and converts it to a JS object
 * that is easier to work with.
 */
function parseToObject(arrData) {

	csvObject = {};
		
	if (arrData[0].length == 0) {
		arrData.shift();
	}
	
	if (arrData[arrData.length-1] == "") {
		arrData.pop();
	}
	
	var csvHeaders = arrData.shift();
			
	for (var rowIndex = 0; rowIndex < arrData.length; rowIndex++) {
		var rowArray = arrData[rowIndex];
		for (var propIndex = 0; propIndex < rowArray.length; ++propIndex) {
			if (csvObject[csvHeaders[propIndex]] == undefined) {
				csvObject[csvHeaders[propIndex]] = [];
			}
			// Convert DD/MM/YYYY to YYYY-MM-DD
			if (/^[0-9]{2}\/[0-9]{2}\/[0-9]{4}/.test(rowArray[propIndex])) {
				rowArray[propIndex] = parseDate(rowArray[propIndex]);
			}

			csvObject[csvHeaders[propIndex]].push(rowArray[propIndex]);

		}
	}
	
	csvObject["num_patients"] = arrData.length;

	//PSS includes a blank column
	if (csvObject.hasOwnProperty("")) {
		delete csvObject[""];
	}
	
	return csvObject;
};

// Converts DD/MM/YYYY to YYYY-MM-DD string
function parseDate(date) {
	if (date != "") {
		var parsedDate = date.split("/");
		return parsedDate[2].concat("-", parsedDate[1], "-", parsedDate[0]);
	} else
	return 0;
};


/*
Array.prototype.indicesOfElementsInArrayIndex = function(arr) {
	var index = [];
	for (i=0; i<this.length; i++) {
		if (arr.indexOf(this[i]) != -1) {
			index.push(i);
		}
	}
	return index;
};
*/


/*
 * Repeat a value L times
 * Used to populate an array of identical elements
 * (Silly, I know)
 */
repeat = function(what, L){
	var arr = [];
	while(L) arr[--L]= what;
	return arr;
};