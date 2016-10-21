/*
	Chronic Disease Report Generator - Web based reports on quality of care standards
    Copyright (C) 2015  Kevin Lin, Tom Sitter - Hamilton Family Health Team

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.
*/

var indicators =  (function(){
	
	//Used in indicator editor to convert common variable names into human readable names
	var lookupVarNameTable = {
		'minAge': 'Minimum Age',
		'maxAge': 'Maximum Age',
		'months': 'Months Since',
		'minAgeMonths': 'Minimum Age (months)',
		'maxAgeMonths': 'Maximum Age (months)',
		'sysTarget': 'Systolic BP Target',
		'diasTarget': 'Diastolic BP Target',
		'age': 'Age'
	};

	//From literature, plotted on appropriate indicators
	var LHINAverages = {
		'DiabeticAssessment': 0.433, //percent
		'DateHbA1C': 0.591, //% HbA1c done in past 6 months
		'LDL': 0.706, //% measured in past twelve months
		'BPUnderControl': 0.66, //% patients with BP < 140/90
		'SmokingCessation': 0.56, //% receiving advice to quit smoking in past year
		'Smokers': 0.192, //% Daily smokers (Ontario HSIP Report)
		'Mamm': 0.60,
		'Pap': 0.66,
		'FOBT': 0.32,
	};


	//Need to be defined
	var indicatorGoal = {
		'Mamm': 0.5,
		'Pap': 0.5,
		'FOBT': 0.5,
	};

	var mEMR = {
		"PSS": true,
		"Oscar": false,
		"Accuro": false
	};

	function isOSCAR() {
		return mEMR["Oscar"];
	}

	function isPSS(){;
		return mEMR["PSS"];
	}

	function isAccuro(){;
		return mEMR["Accuro"];
	}

	function setEMR(emr) {
		// Set all values to false
		for (var key in mEMR) {
			if (mEMR.hasOwnProperty(key))
				mEMR[key] = false;
		}

		// Set the selected EMR as true in mEMR
		mEMR[emr] = true;
	}

	function getEMR() {
		for (var key in mEMR) {
			if (mEMR.hasOwnProperty(key) && mEMR[key] === true) {
				return key;
			}
		}

		return null;
	}

	// File Number for Oscar CYMH
	var mFileNumber;
	

	/*************************** HELPER FUNCTIONS ****************************
	
	These functions are used by indicators to help work with dates and ages
	*************************************************************************/

	function convertToDate(dateString) {
		var dateRegex = /\d{2}[/-]\d{2}[/-]\d{4}/; //matches dd-mm-yyyy and dd/mm/yyyy 

		if (dateString === "") {
			return null;
		}

		if (dateString.toString().match(dateRegex)) {
			var dateParts = dateString.split(/[/-]/);
			var parsedDate = new Date(dateParts[2], dateParts[1]-1, dateParts[0]);
	 	} else { 
	 		var parsedDate = new Date(dateString);
	 	}

		return parsedDate; 
	}


	/**
	 * Find the date X months ago
	 * @param  {Date} 		date     Starting date
	 * @param  {numeric} 	months 	 Months to go back
	 * @return {Date}        		 Date it was X months ago
	 */
	function removeMonths(date, months) {
  		return new Date(date.setMonth(date.getMonth() - months));
	};

	/**
	 * Checks if the measured date is within X months ago from the current date
	 * 
	 * @param  {Date | String} 	currentDate  	String (dd-mm-yyyy or dd/mm/yyyy) or Date object of report date
	 * @param  {numeric} 		monthsAgo 		Number of months from report date the measured date can be
	 * @param  {Date | String} 	measuredDate 	The date that the measurement was taken
	 * @return {boolean}              		 	true if within date range, false if out of date
	 */
	function withinDateRange(currentDate, monthsAgo, measuredDate) {
		var dateRegex = /\d{2}[/-]\d{2}[/-]\d{4}/; //matches dd-mm-yyyy and dd/mm/yyyy 

		//If never measured, return false
		if (measuredDate == "") {
			return false;
		}

		//Turn currentDate string into Date object with date currentDate - maxMonthsAgo
	 	var targetDate = removeMonths(convertToDate(currentDate), monthsAgo); 

	 	//Turn measuredDate into a Date object
	 	var measuredDate = convertToDate(measuredDate)

	 	if (measuredDate > convertToDate(currentDate)) {
	 		return NaN;
	 	}

	 	//Make sure measuredDate was measured more recently than the target date.
	 	return measuredDate >= targetDate;	
	};

	/**
	 * Returns a number indicating the months difference between the current date and the measurement date
	 * @param  {String | Date} 	currentDate  	Date report was pulled
	 * @param  {String | Date} 	measuredDate 	Date measurement was taken
	 * @return {numeric}		monthDiff		Months difference between the two              	
	 */
	function monthsDifference(currentDate, measuredDate) {

		//Return false if neither exist
		if (currentDate == null || measuredDate == null) {
			return NaN;
		}

		var cd = convertToDate(currentDate);
		var md = convertToDate(measuredDate);
		//var timeDiff = cd.getTime() - md.getTime();
		//var monthDiff = Math.ceil(timeDiff / (1000 * 3600 * 24 * 30));

		var monthDiff = moment(cd).diff(moment(md), 'months');

		return monthDiff;
	}
	
	/**
	 * Returns the most recent date from an array of dates, or null if it is empty
	 * @param  {[String | Date]} dateArray 	Array of string dates
	 * @return {Date}           			Most recent date, or null
	 */
	function mostRecentDate(dateArray) {
		var parsedDateArray = [];

		for (var i=0; i < dateArray.length; i++) {
			var parsedDate = convertToDate(dateArray[i]);
			parsedDateArray.push(parsedDate);
		}
		
		if (Math.max.apply(null, parsedDateArray) === 0) {
			return null;
		}

		return Math.max.apply(null,parsedDateArray);
	}

	/**
	 * Returns an integer age given the age in days, wk, mo, or years
	 * @param  {String} 	age 	Can be 1-25days, 3-11wk, 3-35mo, or 3+ (years)
	 * @return {numeric}     		Age in years, whole number only
	 */
	function getAgeFromMonths(age){
		if (age.indexOf('mo') > 0) {
			return Math.floor(parseInt(age, 10) / 12);
		} else if (age.indexOf('wk') > 0 || age.indexOf('days') > 0) {
			return 0;
		} else {
			return Number(age);
		}
	}
	

/*************************** End of Helper Functions **************************/




	function resetToDefault(rule) {
		if (rule.hasOwnProperty("modifiable") && rule.hasOwnProperty("defaults")) {
			var fields = rule.modifiable;
			var defaults = rule.defaults;
			for (var i = 0; i < fields.length; i++) {
				rule[fields[i]] = defaults[i];
			}
		}
	}

	function getPlotData(indicator, dateIndex) {

		if (indicator.hasOwnProperty('histogram')) {
			var cols = indicator.histogram[0];
			var rule = indicator.histogram[1];
			var label = indicator.histogram[2];
		} else if (indicator.hasOwnProperty('scatter')) {
			var cols = indicator.scatter[0];
			var rule = indicator.scatter[1];
			var label = indicator.scatter[2];
		} else {
			return null;
		}

		var values = [];
		var data = mdsReader.getData();
		var numParams = cols.length;
		
		for (i=0; i<numParams; i++) {
			if (!data[dateIndex].hasOwnProperty(cols[i])) {
				console.log("Rule: " + indicator.desc() + " requires column " + cols[i]);
				return null;
			}
		}
			
		var numItems = data[dateIndex][cols[0]].length;
			
		for (var e = 0; e < numItems; e++) {
			var argList = [];
			for (var p=0; p<numParams;p++) {
				argList.push(data[dateIndex][cols[p]][e]);
			}
			values.push(rule.apply(indicators, argList));
		}
		
		return [values.filter(function(e) { return !isNaN(e); }), label];
	}


	//Expect indicator to have property 'histogram' of type
	// histogram: ['column name', 'data type']
	function getHistogramData(indicator) {

		var col = indicator.histogram[0];
		var method = indicator.histogram[1];

		var data = [];

		if (type === "numeric") {
			for (var row=0; row<csvObject[col].length; row++)
				data.push(+csvObject[col][row]);
		} else if (type === "date") {
			for (var row=0; row<csvObject[col].length; row++)
				data.push(convertToDate(csvObject[col][row]));
		}
		return data;
	}

	//Expect indicator to have property 'scatter' of type
	// scatter: ['x column name', 'y column name', 'x data type', 'y data type']
	function getScatterData(indicator) {

		var xcol = indicator.histogram[0];
		var ycol = indicator.histogram[1];
		var xtype = indicator.histogram[2];
		var ytype = indicator.histogram[3];

		var xdata = [];
		if (xtype === "numeric") {
			for (var row=0; row<csvObject[xcol].length; row++)
				xdata.push(+csvObject[xcol][row]);
		} else if (xtype === "date") {
			for (var row=0; row<csvObject[xcol].length; row++)
				xdata.push(convertToDate(csvObject[xcol][row]));
		}

		var ydata = [];
		if (ytype === "numeric") {
			for (var row=0; row<csvObject[ycol].length; row++)
				ydata.push(+csvObject[ycol][row]);
		} else if (ytype === "date") {
			for (var row=0; row<csvObject[ycol].length; row++)
				ydata.push(convertToDate(csvObject[ycol][row]));
		}

		return [xdata, ydata];
	}

/*  Unused
	var ICD9Regex = /\d+(\.\d+)*:/g
	function extractICD9(prob) {
		if (!prob) {
			return "";
		}

		var icd9regex = /\d+(\.\d+)*:/g;
		codes = prob.match(icd9regex);
		if (!codes) {
			return "";
		}

		var codeStr = ''
		for (var i = 0; i<codes.length; i++) {
			codeStr+=codes[i].slice(0, -1);
			if (i < codes.length-1) {
				codeStr+=", ";
			}
		}
		return codeStr;
	}
*/
	
	function applyRules(ruleListIndex, filteredData) {
		//Loop through data from each file
		var results = [];
		
		var currentRuleList = ruleList[ruleListIndex];
		
		//loop through each file
		for (var i = 0; i < filteredData.length; i++) {
			mFileNumber = i;
			results.push(checkRules(filteredData[i], currentRuleList.rules));
		}
		
		return results;
	};

	function checkRules(csvObject, ruleList) {
	
		var results = [];
		
		forRule:
		for (var r = 0; r < ruleList.length; r++) {
			var currentRule = ruleList[r];
			var passed = [];
		
			for (i=0; i<currentRule.col.length; i++) {
				if (!csvObject.hasOwnProperty(currentRule.col[i])) {
					console.log("Rule " + indicator.desc() + " requires column " + cols[i]);
					continue forRule;
				}
			}
			
			var numPatients = csvObject[currentRule.col[0]].length;
			var numNonRostered = 0;
			var numParams = currentRule.col.length;
			
			for (var p = 0; p < numPatients; p++) {
				var argList = [];
				
				//If the "Rostered" column exists and user wants rostered patients only
				//then filter them out here and reduce the total number of patients.
				if (mdsViewer.hasRosteredField() && mdsViewer.rosteredOnly()) {
					if (csvObject["Rostered"][p].toUpperCase() == "FALSE" || 
						(isOSCAR() && csvObject["Rostered"][p].toUpperCase() != "RO")) {
						numNonRostered++;
						continue;
					}
				}
				
				for (var c=0; c<numParams;c++) {
					argList.push(csvObject[currentRule.col[c]][p]);
				}
				passed.push(currentRule.rule.apply(currentRule, argList));
			}
			
			//numNonRostered is 0 unless non-rostered patients are to be removed
			numPatients -= numNonRostered;

			//Count the number of cases that passed the test
			results.push({	
					index: r,
					desc: currentRule.desc(),
					//Add the longer description as the tooltip if it exists, otherwise use the regular description
					tooltip: typeof(currentRule.long_desc) === 'function' ? currentRule.long_desc() : currentRule.desc(),
					passedIndex: passed,
				  	passed: passed.filter(function(p) { return (p == true); }).length,
				  	total: numPatients - passed.filter(function(p) { return isNaN(p); }).length
			});
		}	
		return results;
	};
	
	/* 
	 * Inspect header of text file to guess which indicator set is most appropriate
	 * Indicator sets are listed in the ruleList variable in indicators
	 */
	function getCurrentRuleSet(header) {
		if (header.indexOf("Patient #") == -1 || header.indexOf("Doctor Number") == -1) {
			alert("File does not contain necessary data element Patient # or Doctor Number");
			throw new Error("File does not contain necessary data element Patient # or Doctor Number");
		}
		
		var rule = 0;
		
		//Diabetes
		if (header.indexOf("Hb A1C") != -1) {
			rule = 0;
		//Hypertension
		} else if (header.indexOf("Systolic BP") != -1) {
			rule = 1;
		//Immunizations
		} else if (header.indexOf("height date") != -1 || header.indexOf("measurements") != -1) {
			rule = 2;
		//Lung Health
		} else if (header.indexOf("COPD Screening Date") != -1) {
			rule = 3;
		//Smoking Cessation
		} else if (header.indexOf("Smoking Cessation Date") != -1) {
			rule = 4;
		//Depression
		} else if (header.indexOf("PHQ9 Dates") != -1) {
			rule = 5;
		//Cancer Screening
		} else if (header.indexOf("Mammogram") != -1) {
			rule = 6;
		} else if (header.indexOf("Rourke") != -1) {
			rule = 7;
		//Youth ADHD
		} else {
			rule = 8;
		}
		
		return rule;
	}
	

/*
****************************************
*************  INDICATORS  *************
****************************************

*** Example Indicator ***

var IndicatorName = {

	*** Plain text summary of indicator, used as y-axis labels in bar graph ***
	desc: function(){ return "A1C \u2264 " + this.target + " in past " + this.months + " months"; },

	*** Columns required in data file for the rule to run ***
	col: ["Current Date", "Date Hb A1C", "Hb A1C"],

	*** The following are used to define the specific values needed to satisfy the indicator ***
	months: 6,
	target: 0.08,

	*** Rule that will evaluate the input and return either: 										***
	***		* true (if passed), 																	***
	***		* false (if failed), or 																***
	***		* NaN (if rule does not apply to this patient)											***
	***	The input to this rule are the columns defined in col: 										***
	*** There are a number of helper functions (see below) that can assist in checking indicators 	***
	rule: function(currentDate, measuredDate, value) {
	 		try {
	 			return (withinDateRange(currentDate, this.months, measuredDate) && Number(value) <= this.target);
	 		} catch (err) {
	 			return false;
	 		}
	 	}

	*** OPTIONAL ***
	 
	*** Long summary, used as tooltip text over bar 					***
	*** Program will use the regular description if this is not defined ***
	long_desc: function(){return "% of patients with A1C less than or equal to " + this.target + " measured in the past " + this.months + " months";},


	*** If you want any values to be modifiable by the user, list them below ***
	*** Also, set default values so they can be reset ***
	modifiable: ["months", "target"],
	defaults: [6, 0.08],

	*** HFHT Average, LHIN Average, and HFHT Goal can be plotted when included in the indicator ***
	
	average: LHINAverages.BPUnderControl,
	hfhtaverage: HFHTAverages.BPUnderControl,
	goal: goal.BPUnderControl

	*** If you want to be able to plot a histogram, you need to provide 3 pieces of information stored in an array ***
	*** 	1. The column(s) that holds the data, examples
	***			* ["Hb A1C"]
	***			* ["Hb A1C", "Date Hb A1C"]
	***		2. The function that will convert it into a histogram value. Takes the columns defined above as the inputs
	***			* This function takes the "Hb A1C" column and returns it as a number. If A1C is > 1 it divides by 100 first
	***			* function(a1c) { if (Number(a1c) > 1) { return (Number(a1c) / 100); } else { return Number(a1c); } }
	***		3. The name of the x-axis for the histogram
	***			* "Hb A1C (%)"
	histogram: [["Hb A1C"], function(v) { if (Number(v) > 1) { return (Number(v) / 100); } else { return Number(v); } }, "Hb A1C (%)"],
};


*** End of Example Indicator ***

*** Indicators are grouped into indicator lists (e.g. diabetes, hypertension, lung health) ***
*** These indicator lists are made available to the user in a dropdown menu ***

*** Assemble indicators into sets ***
var diabetesIndicators = [ruleDMPastNMonthsBilling,
					 	  ruleA1CPastNMonths, 
					 	  ruleA1CLessThanEqualToXPastNMonths,
					 	  ruleLDLPastNMonths];

*** Add sets of indicators to the master list ***
var ruleList = [{name:"Diabetes", rules:diabetesRules},
				{name:"Hypertension", rules:hypertensionRules},
				{name:"Immunizations", rules:immunizationRules},
				{name:"Lung Health", rules:lungHealthRules},
				{name:"Smoking Cessation", rules:smokingCessationRules}];


*/

	// Copy this template when creating new indicators
	// See comments above for explanation of each field and additional optional fields
	var ruleTemplate = {
		desc: function(){ return "Indicator axis label"; },
		long_desc: function() { return "Indicator hover text message"; },
		col: [""],
		rule: function(){
			try {
				
			} catch(err) {
				console.log(err.message);
	 			return NaN;
			}
		}
	}


	var ruleDMPastNMonths = {
		desc: function(){return "Diabetic Visit in past " + this.months + " months"; },
		long_desc: function(){return "% of patients who have had a diabetic visit (diagnostic code 250) in the past " + this.months + " months"; },
	 	months: 12,
	 	modifiable: ["months"],
	 	defaults: [12],
	 	col: ["Current Date", "DM Months"],
	 	histogram: ["DM Months", "date"],
	 	rule: function(currentDate, measuredDate) {
	 		try {
	 			if (measuredDate == "") {
	 				return false;
	 			} else if (convertToDate(measuredDate) > convertToDate(currentDate)) {
	 				return NaN;
	 			}

	 			// Old version output date of last assessment
	 			// New version outputs number of months since last assessment,
	 			// have to check which case and handle appropriately 
	 			targetDate = removeMonths(convertToDate(currentDate), this.months);
		 		if (isNaN(Number(measuredDate))) {
			 		var measuredDate = convertToDate(measuredDate);
			 		var targetDate = removeMonths(convertToDate(currentDate), this.months);

			 		return (measuredDate >= targetDate);
			 	} else {
			 		return (Number(measuredDate) <= this.months);
			 	}
	 		} catch (err) {
	 			console.log(err.message);
	 			return NaN;
	 		}
	 	}
	};
	
	var ruleDMPastNMonthsBilling = {
		desc: function(){return "Diabetic Assessment in past " + this.months + " months"; },
		long_desc: function(){return "% of patients who have had a diabetic assessment (K030/Q040) in the past " + this.months + " months"; },
	 	months: 12,
	 	modifiable: ["months"],
	 	defaults: [12],
	 	col: ["Current Date", "K030A", "Q040A"],
	 	average: LHINAverages.DiabeticAssessment,
	 	histogram: [ ["Current Date", "K030A", "Q040A"], 
	 				 function(c, k, q) { return monthsDifference(c, mostRecentDate([k, q]));},
	 				 "Months Ago" 
	 			   ],
	 	rule: function(currentDate, k, q) {
	 		try {
	 			if (k === "" && q === "") {
	 				return false;
	 			//All measurements should be older than the current date
	 			} else if (convertToDate(k) > convertToDate(currentDate) || convertToDate(q) > convertToDate(currentDate)) {
		 			return NaN;
		 		}

	 			// Using diabetic assessment billing codes
	 			// K030A -- quarterly, Q040 -- annual
 				var targetDate = removeMonths(convertToDate(currentDate), this.months);

		 		return (mostRecentDate([k, q]) >= targetDate);
	 		} catch (err) {
	 			console.log(err.message);
	 			return NaN;
	 		}
	 	}
	};


	var ruleA1CPastNMonths = {
		desc: function(){ return "A1C measured in past " + this.months + " months"; },
		//long_desc: function(){ return "% of patients with A1C measured in past " +  this.months + " months"; },
		months: 6,
		modifiable: ["months"],
		defaults: [6],
	 	col: ["Current Date", "Date Hb A1C"],
	 	average: LHINAverages.DateHbA1C,
	 	histogram: [["Current Date", "Date Hb A1C"], function(cd, md) { return monthsDifference(cd, md); }, "Months Ago"],
	 	rule: function(currentDate, measuredDate) {
	 		try {
	 			return withinDateRange(currentDate, this.months, measuredDate);
	 		} catch (err) {
	 			console.log(err.message);
	 			return NaN;
	 		}
	 	}
	};
	
	var ruleA1CLessThanEqualToXPastNMonths = {
		desc: function(){ return "A1C \u2264 " + this.target + " in past " + this.months + " months"; },
		long_desc: function(){return "% of patients with A1C less than or equal to " + this.target + " measured in the past " + this.months + " months";},
	 	col: ["Current Date", "Date Hb A1C", "Hb A1C"],
		target: 0.08,
		months: 6,
		modifiable: ["months", "target"],
		defaults: [6, 0.08],
		histogram: [["Hb A1C"], function(v) { if (+v > 1) { return (+v / 100); } else { return +v; } }, "Hb A1C (%)"],
	 	rule: function(currentDate, measuredDate, value) {
	 		try {
	 			return (withinDateRange(currentDate, this.months, measuredDate) && Number(value) <= this.target);
	 		} catch (err) {
	 			console.log(err.message);
	 			return NaN;
	 		}
	 	}
	};
	

	var ruleBPPastNMonths = {
		desc: function(){return "BP measured in past " + this.months + " months";},
		long_desc: function(){return "% of patients with BP measured in past " + this.months + " months";},
	 	col: ["Current Date", "Date Systolic BP"],
	 	months: 6,
	 	modifiable: ["months"],
	 	defaults: [6],
	 	rule: function(currentDate, measuredDate) {
	 		try {
	 			return withinDateRange(currentDate, this.months, measuredDate);
	 		} catch (err) {
	 			console.log(err.message);
	 			return NaN;
	 		}
	 	}
	};
	
	var ruleBPLessThanS_DLastNMonths = {
		desc: function(){return "BP < " + this.sysTarget + "/" + this.diasTarget +" in past " + this.months + " months";},
		long_desc: function(){return "% of patients with BP less than " + this.sysTarget + "/" + this.diasTarget + 
									" measured in the past " + this.months + " months";},
	 	col: ["Current Date", "Date Systolic BP", "Systolic BP", "Diastolic BP"],
	 	months: 6,
	 	sysTarget: 130,
		diasTarget: 80,
	 	modifiable: ["months", "sysTarget", "diasTarget"],
	 	defaults: [6, 130, 80],
	 	rule: function(currentDate, measuredDate, sysValue, diasValue) {
	 		try {
	 			return (withinDateRange(currentDate, this.months, measuredDate) &&
	 				   (Number(diasValue) < this.diasTarget && Number(sysValue) < this.sysTarget));
	 		} catch (err) {
	 			console.log(err.message);
	 			return NaN;
	 		}
	 	}
	};

	var ruleLDLPastNMonths = {
		desc: function(){return "LDL measured within the past " + this.months + " months";},
		long_desc: function(){return "% of diabetic patients with LDL measured within the past " + this.months + " months";},
		col: ["Current Date", "Date LDL"],
		months: 12,
		modifiable: ["months"],
		defaults: [12],
		histogram: [["Current Date", "Date LDL"], function(cd, md) { return monthsDifference(cd, md); }, "Months Ago"],
		average: LHINAverages.LDL,
		rule: function(currentDate, measuredDate) {
			 try {
	 			return withinDateRange(currentDate, this.months, measuredDate);
	 		} catch (err) {
	 			console.log(err.message);
	 			return NaN;
	 		}
		}
	};
	
	var ruleLDLLessThanEqualToXPastNMonths = {
		desc: function(){return "LDL \u2264 " + this.target + " in past " + this.months + " months";},
		long_desc: function(){return "% of diabetic patients with LDL less than or equal to " + this.target + " measured within the past " + this.months + " months";},
		col: ["Current Date", "Date LDL", "LDL"],
		months: 12,
		target: 2.0,
		modifiable: ["months", "target"],
		defaults: [12, 2.0],
		histogram: [["LDL"], function(v) { return +v; }, "LDL"],
		rule: function(currentDate, measuredDate, value) {
			 try {
	 			return withinDateRange(currentDate, this.months, measuredDate) && 
	 				   (Number(value) <= this.target || value == "<1.00");
	 		} catch (err) {
	 			console.log(err.message);
	 			return NaN;
	 		}
		}
	};
	
	var ruleACRLastNMonths = {
		desc: function(){return "ACR measured in past " + this.months + " months"; },
		long_desc: function(){return "% of patients with ACR measured in past " + this.months + " months";},
		months: 12,
		modifiable: ["months"],
		defaults: [12],
	 	col: ["Current Date", "Date Microalbumin/Creatinine Ratio", "Microalbumin/Creatinine Ratio"],
	 	rule: function(currentDate, measuredDate, value) {
	 		try {
	 			return withinDateRange(currentDate, this.months, measuredDate) && Number(value) != NaN;
	 		} catch (err) {
	 			console.log(err.message);
	 			return NaN;
	 		}
	 	}
	};
	
	// ACR should be less than or equal to 2 for both men and women
	// http://guidelines.diabetes.ca/executivesummary/ch1
	var ruleACRLessThanEqualToXLastNMonths = {
		desc: function(){return "ACR \u2264 " + this.target + " in past " + this.months + " months"; },
		long_desc: function(){return "% of patients with ACR \u2264 " + this.target + " measured in past " + this.months + " months";},
		months: 12,
		target: 2.0,
		modifiable: ["months", "target"],
		defaults: [12, 2.0],
	 	col: ["Current Date", "Date Microalbumin/Creatinine Ratio", "Microalbumin/Creatinine Ratio", "Sex"],
	 	rule: function(currentDate, measuredDate, value, sex) {
	 		try {
	 			return withinDateRange(currentDate, this.months, measuredDate) && (Number(value) <= this.target || value == "<2.0");
	 		} catch (err) {
	 			console.log(err.message);
	 			return NaN;
	 		}
	 	}
	};
	
	// var ruleACRFemaleLessThanXLastNMonths = {
	// 	desc: function(){return "ACR Female < " + this.target + " in past " + this.months + " months"; },
	// 	long_desc: function(){return "% of female patients with ACR less than " + this.target + " measured in past " + this.months + " months";},
	// 	months: 12,
	// 	target: 2.8,
	// 	modifiable: ["months", "target"],
	// 	defaults: [12, 2.8],
	//  	col: ["Current Date", "Date Microalbumin/Creatinine Ratio", "Microalbumin/Creatinine Ratio", "Sex"],
	//  	rule: function(currentDate, measuredDate, value, sex) {
	//  		if (sex != "F") {
	//  			return NaN;
	//  		}	 		
	//  		try {
	//   			return withinDateRange(currentDate, this.months, measuredDate) && (Number(value) >= this.target || value=="<2.8");
	//  		} catch (err) {
	//  			console.log("Error: " + err);
	//  			return false;
	//  		}
	//  	}
	// };
	
	var ruleEGFRMeasuredPastNMonths = {
		desc: function(){return "eGFR measured in past " + this.months + " months";},
		long_desc: function(){return "% of patients with eGFR measured in the past " + this.months + " months";},
		months: 12,
		modifiable: ["months"],
		defaults: [12],
	 	col: ["Current Date", "Date eGFR"],
	 	rule: function(currentDate, measuredDate) { 
	 		try {
	 			return withinDateRange(currentDate, this.months, measuredDate);
	 		} catch (err) {
	 			console.log(err.message);
	 			return NaN;
	 		}
	 	}
	};
	
	var ruleEGFRGreaterThanXPastNMonths = {
		desc: function(){return "eGFR > " + this.target + " in past " + this.months + " months";},
		long_desc: function(){return "% of patients with eGFR greater than " + this.target + " measured in the past " + this.months + " months";},
	 	col: ["Current Date", "Date eGFR", "eGFR"],
		months: 12,
		target: 60,
		modifiable: ["months", "target"],
		defaults: [12, 60],
	 	rule: function(currentDate, measuredDate, value) {
			try {
	 			return withinDateRange(currentDate, this.months, measuredDate) && 
	 					(Number(value) > this.target || value == ">=90" || value == ">120");
	 		} catch (err) {
	 			console.log(err.message);
	 			return NaN;
	 		}
	 	}
	};
	
	var ruleCurrentSmokers = {
		desc: function(){return "Current Smokers"; },
		long_desc: function() { return "% of patients who are coded as current smokers"; },
		col: ["Risk Factors"],
		average: LHINAverages.Smokers,
		rule: function(factors) {
			try {
				return (factors.toLowerCase().indexOf("current smoker") != -1);
			} catch (err) {
				console.log(err.message);
	 			return NaN;
			}
		}
	};
	
	var ruleBaselineBP = {
		desc: function(){return "BP measured in past " + this.months + " months for  adults > " + this.age; },
		long_desc: function(){return "% of patients with BP measured in the past " + this.months + " months for adults over " + this.age; },
		col: ["Current Date", "Date Systolic BP", "Age"],
		months: 12,
		age: 40,
		modifiable: ["months", "age"],
		defaults: [12, 40],
		histogram: [["Current Date", "Date Systolic BP", "Age"], 
					function(cd, md, age) { if (+age >= this.age) { return monthsDifference(cd, md); } else { return NaN; }}, 
					"Months Ago"],
		rule: function(currentDate, measuredDate, age) {
			try {
				if (Number(age) < this.age) {
					return NaN;
				} else {
					return withinDateRange(currentDate, this.months, measuredDate);
	 			}
			} catch (err) {
				console.log(err.message);
	 			return NaN;
			}
		}
	};

	//Patients with hypertension and an elevated blood pressure have come in for a regular checkup
	var ruleElevatedBPRegularVisit = {
		desc: function(){return "Hypertensive patients with BP > " + this.sysTarget + "/" + this.diasTarget + " who visited within " + this.months + " months"; },
		long_desc: function() { return "% of patients diagnosed with hypertension and with BP over " + this.sysTarget + "/" + this.diasTarget + 
										" who have had a visit within the past " + this.months + " months"; },
		col: ["Current Date", "Last Seen Date", "Systolic BP", "Diastolic BP", "Problem List"],
		months: 9,
		sysTarget: 140,
		diasTarget: 90,
		modifiable: ["months", "sysTarget", "diasTarget"],
		defaults: [9, 140, 90],
		rule: function(currentDate, lastSeenDate, sysValue, diasValue, icd9) {
			try {
				if (icd9.indexOf("401") == -1 || (Number(sysValue) < this.sysTarget && Number(diasValue) < this.diasTarget)) {
					return NaN;
				} else {
					return withinDateRange(currentDate, this.months, lastSeenDate);
	 			}
			} catch (err) {
				console.log(err.message);
	 			return NaN;
			}
		}
	};
	
	//Patients with hypertension and health blood pressure
	var ruleHypertensionBP= {
		desc: function(){return "Hypertensive patients with BP < " + this.sysTarget + "/" + this.diasTarget; },
		long_desc: function() { return "% of patients diagnosed with hypertension and with BP less than " + this.sysTarget + "/" + this.diasTarget; },
		col: ["Systolic BP", "Diastolic BP", "Problem List"],
		sysTarget: 140,
		diasTarget: 90,
		modifiable: ["sysTarget", "diasTarget"],
		defaults: [140, 90],
		average: LHINAverages.BPUnderControl,
		rule: function(sysValue, diasValue, icd9) {
			try {
				if (icd9.indexOf("401") == -1 || sysValue === "") {
					return NaN;
				} else {
					return (Number(sysValue) < this.sysTarget && Number(diasValue) < this.diasTarget);
	 			}
			} catch (err) {
				console.log(err.message);
	 			return NaN;
			}
		}
	};
	
	//Only checks diphtheria and measles
	var ruleInfantVaccinations = {
		desc: function(){return "Infants " + this.age + " years old with all immunizations"; },
		long_desc: function() { return "Infants " + this.age + " years old with " +
										this.diphtheria + " doses of diphtheria and " + this.measles + " dose of measles"; },
		col: ["Age", "measles", "diphtheria"],
		age: 2,
		diphtheria: 4,
		measles: 1,
		modifiable: ["age"],
		defaults: [2],
		rule: function(ageStr, measles, diphtheria) {
			try {
				var age = getAgeFromMonths(ageStr);
				if (typeof age === "number" && age == this.age) {
						return (Number(measles) >= this.measles &&
							Number(diphtheria) >= this.diphtheria);
				} else {
					return NaN;
				}
			} catch (err) {
				console.log(err.message);
	 			return NaN;
			}
		}
	};
	
	//Only checks diphtheria and measles
	var ruleChildVaccinations = {
		desc: function(){return "Children " + this.minAge + "-" + this.maxAge + " with all immunizations"; },
		long_desc: function() { return "Children between " + this.minAge + " and " + this.maxAge + " with " +
										this.diphtheria + " doses of diphtheria and " + this.measles + " doses of measles"; },
		col: ["Age", "measles", "diphtheria"],
		minAge: 7,
		maxAge: 13,
		diphtheria: 5,
		hib: 4,
		pneuc: 3,
		rotavirus: 2,
		mencc: 1,
		measles: 2,
		varicella: 2,
		modifiable: ["minAge", "maxAge"],
		defaults: [7, 13],
		rule: function(ageStr,	measles, diphtheria) {
			try {
				var age = getAgeFromMonths(ageStr);
				if (typeof age === "number" && age >= this.minAge && age <= this.maxAge) {
					return (Number(measles) >= this.measles &&
							Number(diphtheria) >= this.diphtheria)
	 			} else {
	 				return NaN;
				}
				
			} catch (err) {
				console.log(err.message);
	 			return NaN;
			}
		}
	};

	// Checks for diphtheria booster vaccination when patient was 14-16
	var ruleTeenagerVaccinations = {
		desc: function(){return "Adults " + this.minAge + "-" + this.maxAge + " with diphtheria booster"; },
		long_desc: function() { return "Adults between " + this.minAge + " and " + this.maxAge + " with diphtheria booster given since age 14"; },
		col: ["Current Date", "Age", "diphtheria date"],
		minAge: 18,
		maxAge: 25,
		modifiable: ["minAge", "maxAge"],
		defaults: [18, 25],
		rule: function(currentDate, ageStr, dipDate) {
			try {
				//if younger than 18 then not included
				var age = getAgeFromMonths(ageStr);
				var monthsAgo = monthsDifference(currentDate, dipDate);
				
				if (typeof age === "number" && age >= this.minAge && age <= this.maxAge) {

					if (isNaN(monthsAgo)) { return false; }
					//Want to know if they received diphtheria when they were 14-16 
					//therefore, check that the date of the immunization is more recent than (current age - 14 years) ago
					
					//we are theoretically interested in how long ago they were 14, but we can not accurately calculate this
					//because we only know age to the year, so we calculate 13 instead to make sure we don't miss any vaccinations
					maxMonthsAgo = (age - 13) * 12
					return maxMonthsAgo >= monthsAgo;
	 			} else {
	 				return NaN;
	 			}
			} catch (err) {
				console.log(err.message);
	 			return NaN;
			}
		}
	};

	var ruleHeightWeightLastVaccination = {
		desc: function(){ return "Height and Weight at last immunization, patients " + this.minAge + "-" + this.maxAge; },
		long_desc: function() { return "Height and Weight measured at last immunization. Only applies to patients with height and weight measured on the same day"; },
		months: 12,
		minAge: 2,
		maxAge: 18,
		modifiable: ["months", "minAge", "maxAge"],
		defaults: [12, 2, 18],
		col: ["Age", "Current Date", "height date", "weight date", 
			  "measles date", "diphtheria date"],
		rule: function(age, currentDate, heightDate, weightDate, measles, diphtheria) {
			try {
				if (heightDate != weightDate || heightDate == "" || Number(age) < this.minAge || Number(age) > this.maxAge) {
					return NaN;
				} else {
					if (mostRecentDate([measles, diphtheria]) === null && !withinDateRange(currentDate, this.months, heightDate)) {
						return false;
					} else
					return (convertToDate(heightDate) >= mostRecentDate([measles, diphtheria]));
	 			}
			} catch (err) {
				console.log(err.message);
	 			return NaN;
			}
		}
	};
	
	var ruleWellBabyVisit = {
		desc: function() { return "Well Baby Visit for infants " + this.minAge + " to " + this.maxAge + " years old"; },
		long_desc: function() { return "Percent of children " + this.minAge + " to " + this.maxAge + " who have completed their 18 month well baby visit"; },
		col: ["Age", "A002A", "Rourke"],
		minAge: 2,
		maxAge: 3,
		modifiable: ['minAge', 'maxAge'],
		defaults: [2, 3],
		rule: function(age, A002, rourke) {
			try {
				if (Number(age) >= this.minAge && Number(age) <= this.maxAge) {
					return (A002 != 0 || rourke != 0);
				} else { return NaN; }
			} catch (err) {
				console.log(err.message);
	 			return NaN;
			}
		}
	};	

	var ruleSmokingStatusRecorded = {
		desc: function(){return "Smoking Status Recorded for patients \u2265 " + this.age; },
		long_desc: function() { return "Smoking Status Recorded in Risk Factors for patients over the age of " + this.age; },
		age: 12,
		col: ["Risk Factors", "Age"],
		modifiable: ["age"],
		defaults: [12],
		rule: function(factors, age) {
			try {
				if (Number(age) < this.age) {
					return NaN;
				} else if (isOSCAR()) {
					if (factors != "") return true;
					else return false;
				}
				return factors.toLowerCase().indexOf('smok') != -1;
			} catch (err) {
				cconsole.log(err.message);
	 			return NaN;
			}
		}
	};
	
    //Smoking Cessation Form is a count of the number of times LUNG-Smoking_Initial_Assessment_MOHLTC form has been performed
	var ruleSmokingCessation = {
		desc: function(){return "Smoking Cessation Attempted within past " + this.months + " months"; },
		long_desc: function() { return "Smoking Cessation form performed within past " + this.months + 
									   " months for smokers who have seen their doctor in that time"; },
		months: 15,
		modifiable: ["months"],
		defaults:[15],
		col: [	"Risk Factors", 			//get smoking status
				"Smoking Cessation Date",   //smoking intervention date (billing code or relevant documentation)
				"Last Seen Date", 			//last patient visit
				"Current Date"],			// date of report
		averages: LHINAverages.SmokingCessation,
		rule: function(factors, formDate, lastSeenDate, currentDate) {
			try {
				factors = factors.toLowerCase();
				if ((isPSS() && factors.indexOf("current smoker") === -1) ||     //If they don't smoke (PSS), or
					(isOSCAR() && factors.indexOf("yes") === -1) ||  //They don't smoke (OSCAR), or
					!withinDateRange(currentDate,this.months,lastSeenDate)) // They haven't been in in more than 15 months
				{
					return NaN;
				} else {
					return withinDateRange(currentDate, this.months, formDate);	
				}
			} catch (err) {
				console.log(err.message);
	 			return NaN;
			}
		}
	};

	var ruleAdultSmokersPneumovax = {
		desc: function(){return "Smokers > " + this.minAge + " vaccinated with Pneumovax"; },
		long_desc: function() { return "Patients over the age of " + this.minAge + " who smoke and are vaccinated for pneumonia"; },
		col: ["Age", "Risk Factors", "pneumococcal polysaccharide"],
		minAge: 18,
		modifiable: ["minAge"],
		defaults: [18],
		rule: function(age, factors, pneuc) {
			try {
				var factors = factors.toLowerCase();
				//Only people older than 18 who are current smokers qualify
				if (Number(age) <= this.minAge || 
						(isPSS() && factors.indexOf("current smoker") === -1) ||
						(isOSCAR() && (factors.indexOf("current") === -1 && 
									   factors.indexOf("yes") === -1))){
					return NaN;
				} else {
					//Patients with 1 or more pneumovax shots pass
					return Number(pneuc) > 0;
				}
			} catch (err) {
				console.log(err.message);
	 			return NaN;
			}
		}
	};
	
	var ruleSeniorsPneumovax = {
		desc: function(){return "Seniors > " + this.minAge + " vaccinated with Pneumovax"; },
		long_desc: function() { return "Patients over the age of " + this.minAge + " and are vaccinated for pneumonia"; },
		col: ["Age", "pneumococcal polysaccharide"],
		minAge: 65,
		modifiable: ["minAge"],
		defaults: [65],
		rule: function(age, pneuc) {
			try {
				//Only people older than 65 qualify
				if (Number(age) <= this.minAge) {
					return NaN;
				} else if (pneuc === null) {
					return false;
				} else {
					return Number(pneuc) > 0;
				}
			} catch (err) {
				console.log(err.message);
	 			return NaN;
			}
		}
	};

	var ruleLungDiseasePneumovax = {
		desc: function(){return "Adults > " + this.minAge + " with COPD/Asthma vaccinated with Pneumovax"; },
		long_desc: function() { return "Patients over the age of " + this.minAge + 
									   " who have COPD or asthma and are vaccinated for pneumonia"; },
		col: ["Age", "Problem List", "pneumococcal polysaccharide"],
		minAge: 18,
		modifiable: ["minAge"],
		defaults: [18],
		diseaseList: ["copd", "asthma", "chronic bronchitis", "490", "491", "492", "493", "494", "496"],
		rule: function(age, problemList, pneuc) {
			try {
				//Only people older than 18 with a lung disease (see diseaseList) qualify
				if (Number(age) <= this.minAge ||
					//Join diseaseList into a regular expression, test if 
					new RegExp(this.diseaseList.join("|")).test(problemList.toLowerCase()) === false) {
					return NaN;
				} else {
					//Patients with 1 or more pneumovax shots pass
					return Number(pneuc) > 0;
				}
			} catch (err) {
				console.log(err.message);
	 			return NaN;
			}
		}
	};
		
	var ruleLungHealthScreen = {
		desc: function(){return "Lung Health Screening for smokers > " + this.age; },
		long_desc: function() { return "Lung Health Screening performed for smokers over the age of " + this.age; },
		age: 40,
		months: 24,
		modifiable: ["age"],
		col: ["Risk Factors", "Problem List", "COPD Screening Date", "Current Date", "Age"],
		diseaseList: ["copd", "asthma", "chronic bronchitis", "490", "491", "492", "493", "494", "496"],
		rule: function(factors, problemList, screenDate, currentDate, age) {
			factors = factors.toLowerCase();
			try {
				//Filter out people under the minimum age, or who do not smoke, or who are already diagnosed with COPD
				if (Number(age) <= this.age || 
					(isOSCAR() && (factors.indexOf("current") === -1 && factors.toLowerCase().indexOf("yes") === -1)) || 
					(isPSS() && factors.indexOf("current smoker") === -1) || 
					new RegExp(this.diseaseList.join("|")).test(problemList.toLowerCase()) === true)
				{
					return NaN;
				} else {
					//This needs to be a date check! Once a date range is decided upon
					return withinDateRange(currentDate, this.months, screenDate);
				}
			} catch (err) {
				console.log(err.message);
	 			return NaN;
			}
		}
	};
		
	var rulePHQ9 = {
		desc: function(){return "Patients with multiple PHQ9 forms"; },
		long_desc: function() { return "Adult patients who have depression and have filled out at least one PHQ9 form" + 
								 		" have more than one PHQ9 form. This is an indication it is being used for follow-up"; },
		col: ["Current Date", "PHQ9 Dates","PHQ9 Occurrences"],
		months:6,
		modifiable: ["months"],
		defaults: [6],
		rule: function(currentDate, screenDate, count) {
			try {
				if (count == 0 || screenDate == "") {
					return NaN;
				} else if (count == 1 && !withinDateRange(currentDate, this.months, screenDate)) {
					return false;
				} else {
					return true;
				}
			} catch (err) {
				console.log(err.message);
	 			return NaN;
			}
		}
	};

	var ruleADHDMedReview = {
		desc: function(){return "Youth on ADHD meds annual checkup"; },
		long_desc: function() { return "Youth diagnosed with ADHD and on medications for ADHD who have had an annual visit"; },
		col: ["Current Date", "Last Seen Date", "Patient #"],
		months:12,
		modifiable: ["months"],
		defaults: [12],
		rule: function(currentDate, lastSeenDate, patientNumber) {

			// Get mFilteredData for Oscar
			var mFilteredData = mdsReader.getData();

			try {
				if (isPSS()) {
					return withinDateRange(currentDate, this.months, lastSeenDate);
				} else if (mFilteredData[mFileNumber]["Filtered Patients"].indexOf(patientNumber) != -1) {
					return withinDateRange(currentDate, this.months, lastSeenDate);
				}
			} catch (err) {
				console.log(err);
				return false;
			}
		}
	};
	
	var ruleChildYouthMentalHealthScreening = {
		desc: function() { return "Children with recent screening tool"; },
		long_desc: function() { return "Children referred to the child and youth mental health services who" + 
										" have had a screening tool done in the past " + this.years + " years"},
		col: ["Current Date", "Referral Date", "Last Screening"],
		years:2,
		modifiable: ["years"],
		defaults: [2],
		rule: function(currentDate, referralDate, lastScreening) {
			try {
				if (referralDate == "") {
					return NaN;
				} else {
					return withinDateRange(currentDate, this.years*12, lastScreening);
				}
			} catch (err) {
				console.log(err);
				return false;
			}
		}
	};

	var ruleBreastCancer = {
		desc: function(){return "Breast cancer screening within " + this.months/12 + " years, females " + this.minAge + " to " + this.maxAge; },
		long_desc: function() { return "Patients aged " + this.minAge + " to " + this.maxAge + 
										" who received a mammogram in the past " + this.months + " months"; },
		col: ["Current Date", "Age", "Sex", "Mammogram"],
		months:3*12,
		minAge:50,
		maxAge:74,
		modifiable: ["months", "minAge", "maxAge"],
		defaults: [3*12, 50 , 74],
		averages: LHINAverages.Mamm,
		goal: goal.Mamm,
		rule: function(currentDate, age, sex, mammDate) {
			try {
				if (Number(age) < this.minAge || Number(age) > this.maxAge || sex != "F")
					return NaN;
				else
					return	withinDateRange(currentDate, this.months, mammDate)
			} catch (err) {
				console.log(err);
				return false;
			}
		}
	};
	
	var ruleCervicalCancer = {
		desc: function(){return "Cervical cancer screening within " + this.months/12 + " years, females " + this.minAge + " to " + this.maxAge; },
		long_desc: function() { return "Patients aged " + this.minAge + " to " + this.maxAge + " who received a Pap test in the past " + this.months + " months"; },
		col: ["Current Date", "Age", "Sex", "Pap Test Report"],
		months:3*12,
		minAge:21,
		maxAge:69,
		modifiable: ["months", "minAge", "maxAge"],
		defaults: [3*12, 21, 69],
		averages: LHINAverages.Pap,
		goal: indicatorGoal.Pap,
		rule: function(currentDate, age, sex, papDate) {
			try {
				if (Number(age) < this.minAge || Number(age) > this.maxAge || sex != "F")
					return NaN;
				else
					return	withinDateRange(currentDate, this.months, papDate)
			} catch (err) {
				console.log(err);
				return false;
			}
		}
	};
	
	var ruleColorectalCancer = {
		desc: function(){return "Colorectal cancer screening within " + this.months/12 + " years, patients " + this.minAge + " to " + this.maxAge; },
		long_desc: function() { return "Patients over the age of " + this.minAge + " who performed an FOBT in the past " + this.months + " months"; },
		col: ["Current Date", "Age", "FOBT"],
		months:2*12,
		minAge:50,
		maxAge:74,
		modifiable: ["months", "minAge", "maxAge"],
		defaults: [2*12, 50, 74],
		averages: LHINAverages.FOBT,
		goal: indicatorGoal.FOBT,
		rule: function(currentDate, age, fobtDate) {
			try {
				if (Number(age) < this.minAge || Number(age) > this.maxAge)
					return NaN;
				else
					return	withinDateRange(currentDate, this.months, fobtDate)
			} catch (err) {
				console.log(err);
				return false;
			}
		}
	};
	
	var ruleFluVaccine = {
		desc: function(){return "Influenza vaccine within past year, patients > " + this.minAge; },
		long_desc: function() { return "Patients over the age of " + this.minAge + " who received a flu vaccine in the past " + this.months + " months"; },
		col: ["Current Date", "Age", "influenza date"],
		months:12,
		minAge:65,
		modifiable: ["months", "minAge"],
		defaults: [12, 65],
		rule: function(currentDate, age, fluDate) {
			try {
				if (Number(age) <= this.minAge) {
					return NaN;
				} else {
					return withinDateRange(currentDate, this.months, fluDate);
				}
			} catch (err) {
				console.log(err);
				return false;
			}
		}
	};


	/************************************************
	 **************** INDICATOR SETS ****************
	 ************************************************/

	//Assemble rules into sets
	var diabetesRules = [ruleDMPastNMonthsBilling,
						 ruleA1CPastNMonths, 
						 ruleA1CLessThanEqualToXPastNMonths,
						 ruleLDLPastNMonths
					     ];
						 
		//Assemble rules into sets
	var diabetesExtendedRules = [ruleDMPastNMonthsBilling,
								 ruleA1CPastNMonths, 
								 ruleA1CLessThanEqualToXPastNMonths,
								 ruleBPPastNMonths, 
								 ruleBPLessThanS_DLastNMonths,
								 ruleLDLPastNMonths,
								 ruleLDLLessThanEqualToXPastNMonths, 
								 ruleACRLastNMonths,
								 ruleACRLessThanEqualToXLastNMonths,
								 ruleEGFRMeasuredPastNMonths, 
								 ruleEGFRGreaterThanXPastNMonths,
								 ruleCurrentSmokers];
						 
						 
	var hypertensionRules = [ruleBaselineBP,
							 ruleElevatedBPRegularVisit,
							 ruleHypertensionBP];
							 
	var immunizationRules = [ruleHeightWeightLastVaccination,
							 ruleInfantVaccinations,
							 ruleChildVaccinations,
							 ruleTeenagerVaccinations];
							 
	var smokingCessationRules = [ruleSmokingStatusRecorded,
								 ruleSmokingCessation];
	
	var lungHealthRules = [ruleSmokingStatusRecorded,
						   ruleSmokingCessation,
						   ruleAdultSmokersPneumovax,
						   ruleSeniorsPneumovax,
						   ruleLungDiseasePneumovax,
						   ruleLungHealthScreen];
						   
	var adultMentalHealthRules = [rulePHQ9];

	var childYouthMentalHealthRules = [ruleADHDMedReview,
								  ruleChildYouthMentalHealthScreening];
	
	var wellBabyRules = [ruleWellBabyVisit];
	
	var cancerScreeningRules = [ruleBreastCancer,
								ruleCervicalCancer,
								ruleColorectalCancer,
								ruleFluVaccine];

							
	//Add sets of rules to the master list
	var ruleList = [{name:"Diabetes", rules:diabetesRules},
					{name:"Hypertension", rules:hypertensionRules},
					{name:"Immunizations", rules:immunizationRules},
					{name:"Lung Health", rules:lungHealthRules},
					{name:"Smoking Cessation", rules:smokingCessationRules},
					{name:"Depression", rules:adultMentalHealthRules},
					{name: "Adult Preventative Care", rules:cancerScreeningRules},
					{name: "Well Baby", rules:wellBabyRules},
					{name:"ADHD", rules:childYouthMentalHealthRules},
					{name:"Diabetes (Full)", rules:diabetesExtendedRules}];

	
	return {
		applyRules: applyRules,
		ruleList: ruleList,
		resetToDefault: resetToDefault,
		getCurrentRuleSet: getCurrentRuleSet,
		lookupVarNameTable: lookupVarNameTable,
		getPlotData: getPlotData,
		setEMR: setEMR,
		getEMR: getEMR
	};
	
})();