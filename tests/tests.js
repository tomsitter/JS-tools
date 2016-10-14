QUnit.test('Return a CSV object', function(assert) {
	var unparsed = [
		['Patient #', 	'First Name', 	'Last Name', 	'Birthdate'],
		['1', 			'Tom', 			'Sitter', 		'Aug 1, 1990'],
		['2', 			'J', 			'Boy', 			'Sep 20, 1985']
	];

	parsed = csvReader.parseToObject(unparsed);

	assert.equal(parsed["Patient #"]["0"], "1", "Patient numbers parsed properly");
	assert.equal(parsed["Patient #"]["1"], "2", "Patient numbers parsed properly");
	assert.equal(parsed["First Name"]["0"], "Tom", "Patient first names parsed properly");

});


QUnit.test('Trying out QUnit', function(assert) {

	assert.equal(1, "1", "This should pass");

});