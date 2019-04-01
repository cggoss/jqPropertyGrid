/**
 * jqPropertyGrid
 * https://github.com/ValYouW/jqPropertyGrid
 * Author: YuvalW (ValYouW)
 * License: MIT
 */

/* jshint -W089 */
(function($) {
	var OTHER_GROUP_NAME = 'Other';
	var GET_VALS_FUNC_KEY = 'pg.getValues';
	var pgIdSequence = 0;

	/**
	 * Generates the property grid
	 * @param {object} obj - The object whose properties we want to display
	 * @param {object} meta - A metadata object describing the obj properties
	 * @param {object} optionalPropsOrder - An optional array of strings to specify properties order
	 */
	$.fn.jqPropertyGrid = function(obj, meta, optionalPropsOrder) {
		// Check if the user called the 'get' function (to get the values back from the grid).
		if (typeof obj === 'string' && obj === 'get') {
			if (typeof this.data(GET_VALS_FUNC_KEY) === 'function') {
				return this.data(GET_VALS_FUNC_KEY)();
			}
			return null;
		} else if (typeof obj === 'string') {
			console.error('jqPropertyGrid got invalid option:', obj);
			return;
		} else if (typeof obj !== 'object' || obj === null) {
			console.error('jqPropertyGrid must get an object in order to initialize the grid.');
			return;
		}

		// Seems like we are ok to create the grid
		meta = meta && typeof meta === 'object' ? meta : {};
		var propertyRowsHTML = { OTHER_GROUP_NAME: '' };
		var groupsHeaderRowHTML = { };
		var postCreateInitFuncs = [];
		var getValueFuncs = {};
		var pgId = 'pg' + (pgIdSequence++);

		var postAdditionCallbacks = [];

		var currGroup;
		var propsArray = optionalPropsOrder || Object.keys(obj);
		for (var propIndex in propsArray) {
			if (!propsArray.hasOwnProperty(propIndex)) {
				continue;
			}
			var prop = propsArray[propIndex];
			// Skip if this is not a direct property, a function, or its meta says it's non browsable
			if (!obj.hasOwnProperty(prop) || typeof obj[prop] === 'function' || (meta[prop] && meta[prop].browsable === false)) {
				continue;
			}

			// Check what is the group of the current property or use the default 'Other' group
			currGroup = (meta[prop] && meta[prop].group) || OTHER_GROUP_NAME;

			// If this is the first time we run into this group create the group row
			if (currGroup !== OTHER_GROUP_NAME && !groupsHeaderRowHTML[currGroup]) {
				groupsHeaderRowHTML[currGroup] = getGroupHeaderRowHtml(currGroup);
			}

			// Initialize the group cells html
			propertyRowsHTML[currGroup] = propertyRowsHTML[currGroup] || '';

			// Append the current cell html into the group html
			var row = getPropertyRowHtml(pgId, prop, obj[prop], meta[prop], postCreateInitFuncs, getValueFuncs);
			propertyRowsHTML[currGroup] += row.html;
			postAdditionCallbacks.push(row.postAdditionCallback);
		}

		// Now we have all the html we need, just assemble it
		var innerHTML = '<table class="pgTable">';
		for (var group in groupsHeaderRowHTML) {
			// Add the group row
			//innerHTML += groupsHeaderRowHTML[group];
			// Add the group cells
			innerHTML += propertyRowsHTML[group];
		}

		// Finally we add the 'Other' group (if we have something there)
		if (propertyRowsHTML[OTHER_GROUP_NAME]) {
			innerHTML += getGroupHeaderRowHtml(OTHER_GROUP_NAME);
			innerHTML += propertyRowsHTML[OTHER_GROUP_NAME];
		}

		// Close the table and apply it to the div
		innerHTML += '</table>';
		this.html(innerHTML);

		for (var j = 0; j < postAdditionCallbacks.length; j++) {
			postAdditionCallbacks[j]();
		}

		// Call the post init functions
		for (var i = 0; i < postCreateInitFuncs.length; ++i) {
			if (typeof postCreateInitFuncs[i] === 'function') {
				postCreateInitFuncs[i]();
				// just in case make sure we are not holding any reference to the functions
				postCreateInitFuncs[i] = null;
			}
		}

		// Create a function that will return tha values back from the property grid
		var getValues = function() {
			var result = {};
			for (var prop in getValueFuncs) {
				if (typeof getValueFuncs[prop] !== 'function') {continue;}
				result[prop] = getValueFuncs[prop]();
			}

			return result;
		};

		this.data(GET_VALS_FUNC_KEY, getValues);
	};

	/**
	 * Gets the html of a group header row
	 * @param {string} displayName - The group display name
	 */
	function getGroupHeaderRowHtml(displayName) {
		return '<tr class="pgGroupRow"><td colspan="2" class="pgGroupCell">' + displayName + '</td></tr>';
	}

	/**
	 * Gets the html of a specific property row
	 * @param {string} pgId - The property-grid id being rendered
	 * @param {string} name - The property name
	 * @param {*} value - The current property value
	 * @param {object} meta - A metadata object describing this property
	 * @param {function[]} [postCreateInitFuncs] - An array to fill with functions to run after the grid was created
	 * @param {object.<string, function>} [getValueFuncs] - A dictionary where the key is the property name and the value is a function to retrieve the propery selected value
	 */
	function getPropertyRowHtml(pgId, name, value, meta, postCreateInitFuncs, getValueFuncs) {
		if (!name) {return '';}
		meta = meta || {};
		// We use the name in the meta if available
		var displayName = meta.name || name;
		var type = meta.type || '';
		var elemId = pgId + name;

		var valueHTML;


		// If boolean create checkbox
		var options = meta.options;

		if (type === 'boolean' || (type === '' && typeof value === 'boolean')) {
			valueHTML = '<input type="checkbox" id="' + elemId + '" value="' + name + '"' + (value ? ' checked' : '') + ' />';
			if (getValueFuncs) { getValueFuncs[name] = function() {
				return $('#'+elemId).prop('checked');};
			}

		// If options create drop-down list
		} else if (type === 'options' && Array.isArray(options)) {
			valueHTML = getSelectOptionHtml(elemId, value, options);
			if (getValueFuncs) { getValueFuncs[name] = function() {return $('#'+elemId).val();}; }

		// If number and a jqueryUI spinner is loaded use it
		} else if (typeof $.fn.spinner === 'function' && (type === 'number' || (type === '' && typeof value === 'number'))) {
			valueHTML = '<input type="text" id="' + elemId + '" value="' + value + '" style="width:50px" />';
			if (postCreateInitFuncs) { postCreateInitFuncs.push(initSpinner(elemId, options)); }
			if (getValueFuncs) { getValueFuncs[name] = function() {return $('#'+elemId).spinner('value');}; }

		// If color and we have the spectrum color picker use it
		} else if (type === 'color' && typeof $.fn.spectrum === 'function') {
			valueHTML = '<input type="text" id="' + elemId + '" />';
			if (postCreateInitFuncs) {
				postCreateInitFuncs.push(initColorPicker(elemId, value, options));
			}
			if (getValueFuncs) {
				getValueFuncs[name] = function () {
					return $('#' + elemId).spectrum('get').toRgbString();
				};
			}

		} else if (type === 'textarea') {
			var maxlength='';
			if (options!=null && options.maxlength!=null) {
				maxlength = 'maxlength="' + options.maxlength + '"';
			}

			valueHTML = '<textarea class = "pgTextArea" '+maxlength+' id="' + elemId + '">' + value + '</textarea>';
			if (getValueFuncs) {
				getValueFuncs[name] = function () {
					return $('#' + elemId).val();
				};
			}


		} else if (type === 'tags' && typeof $.fn.jtagit === 'function') {
            elemId = elemId.replace(/ /g, '_');
			valueHTML = '<ul id="' + elemId + '"></ul>';
			if (postCreateInitFuncs) {
				postCreateInitFuncs.push(function() {
					var tagsEditor = $('#' + elemId);
					var firstChangeEvent = true;
					var initialTags = value.split(',').map(function(tag) {
						return {label:tag, value:tag};
					});
					tagsEditor.jtagit({
						tagSource: meta.standardTags,
						initialTags: initialTags,
						sortable: true,
						tagsChanged: function (tag, action) {
							if (firstChangeEvent) {
								firstChangeEvent = false;
								return;
							}
							meta.tagValidator(tag, tagsEditor, action);
							var tags = tagsEditor.jtagit("tags");
							var tagToLabel = function(tag) { return tag.label; };
							var tagsCSV = tags.map(tagToLabel).join(',');
							meta.changeCallback(elemId, name, tagsCSV, function () {
								tagsEditor.removeClass("pgModified");
							});
						}

					});
				});
			}
		} else {
			// Default is textbox
			var opt='';
			var cellText='';
			if (options!=null){
				if (options.editable=="false"){
					opt=opt+ ' readonly="readonly" ';
				}

				if (options.style=="large"){
					cellText =' class="pgTextLarge" ';
				}
			}

			valueHTML = '<input type="text"'+cellText+opt+'id="' + elemId + '" value="' + value + '"></input>';
			if (getValueFuncs) {
				getValueFuncs[name] = function () {
					return $('#' + elemId).val();
				};
			}
		}

		if (typeof meta.description === 'string' && meta.description) {
			displayName += '<span class="pgTooltip" title="' + meta.description + '">[?]</span>';
		}


		return {
			html: '<tr class="pgRow"><td class="pgCell">' + displayName + '</td><td class="pgCell">' + valueHTML + '</td></tr>',

			postAdditionCallback: function () {
				if (!meta.changeCallback) {
					return;
				}
				var maxLength=0;
				var element = $('#' + elemId);
				var idDependency=null;
				if (meta.options!=null) {
					var objOptions = meta.options;
					maxLength = objOptions.maxlength;
					if (maxLength!=0 && type=== 'textarea') {
						element.popover({
							content: 'Maximum ' + maxLength + ' characters allowed',
							trigger: 'manual'
						});
					}
				}

				element.on('change', function () {
					var currentValue = $(this).val();

					var colorType = false;
					if (elemId.endsWith('color')) {
						colorType = true;
					}

					if (colorType) {
						currentValue = $('#' + elemId).spectrum('get').toRgbString();
					}

					meta.changeCallback(elemId, name, currentValue, function () {
						$('#' + elemId).removeClass("pgModified");
						if (idDependency!=null){
							$(idDependency).removeClass("pgModified");
						}
					});
				});

				element.on('keyup', function (e) {
					if ((maxLength!=0) ) {
						textLimit($(this).val(), maxLength, elemId);
					}
					var code = e.keyCode || e.which;
					if ((code == 9)||(code == 13)||(code>=16 && code<=20)||(code==27) ||
						(code>=33 && code<=40)||(code>=44 && code<=46)){
						return;
					}
					element.addClass("pgModified");
					if  (meta.options!=null) {
						var objOptions = meta.options;
						var currentValue = $(this).val();

						if (objOptions.validator) {
							var validMessage=objOptions.validator(currentValue);
							if (validMessage!=null){
								element.addClass("noValidCharacter");
								element.popover({
									trigger: 'manual'
								});
								showMessageValidator(elemId, validMessage);
							}else{
								element.removeClass("noValidCharacter");
							}
						}

						idDependency = objOptions.idDependency;
						if (idDependency != null) {

							var depValue= $(idDependency).val();
							if (depValue != null) {
							   var newValue=meta.transformValue(currentValue);
							   if (newValue == ''){
								   return;
							   }
							   $(idDependency).val(newValue);
							   $(idDependency).addClass("pgModified");
							}
						}
					}

				});

				element.on('keypress', function (e) {
					if ((maxLength!=0) ) {
						textLimit($(this).val(), maxLength, elemId);
					}
					element.addClass("pgModified");
				});
			}
		};
	}

	function showMessageValidator( elemId, validMessage) {
		$('#' + elemId).data('bs.popover').options.content = validMessage;
		$('#' + elemId).popover('show');
		setTimeout(function () {
			$('#' + elemId).popover('hide');
		}, 2000);
	}

	function textLimit(value, maxlen, elemId) {
		if (lengthInUtf8Bytes(value) >= parseInt(maxlen)) {
			$('#' + elemId).popover('show');
			setTimeout(function () {
				$('#' + elemId).popover('hide');
			}, 2000);
		}
	}

	function lengthInUtf8Bytes(str) {
		var newLines = str.match(/(\r\n|\n|\r)/g);
		var addition = 0;
		if (newLines != null) {
			addition = newLines.length;
		}

	   return str.length + addition;
	}

	/**
	 * Gets a select-option (dropdown) html
	 * @param {string} id - The select element id
	 * @param {string} [selectedValue] - The current selected value
	 * @param {*[]} options - An array of option. An element can be an object with value/text pairs, or just a string which is both the value and text
	 * @returns {string} The select element html
	 */
	function getSelectOptionHtml(id, selectedValue, options) {
		id = id || '';
		selectedValue = selectedValue || '';
		options = options || [];

		var html = '<select class="pgTextLarge" ';
		if (id) {html += ' id="' + id + '"';}
		html += '>';

		var text, value;
		for (var i = 0; i < options.length; i++) {
			value = typeof options[i] === 'object' ? options[i].value : options[i];
			text = typeof options[i] === 'object' ? options[i].text : options[i];
			html += '<option value="' + value + '"' + (selectedValue === value ? ' selected>' : '>');
			html += text + '</option>';
		}

		html += '</select>';
		return html;
	}

	/**
	 * Gets an init function to a number textbox
	 * @param {string} id - The number textbox id
	 * @param {object} [options] - The spinner options
	 * @returns {function}
	 */
	function initSpinner(id, options) {
		if (!id) {return null;}
		// Copy the options so we won't change the user "copy"
		var opts = {};
		$.extend(opts, options);

		// Add a handler to the change event to verify the min/max (only if not provided by the user)
		opts.change = typeof opts.change === 'undefined' ? onSpinnerChange : opts.change;

		return function() {
			$('#' + id).spinner(opts);
		};
	}

	/**
	 * Gets an init function to a color textbox
	 * @param {string} id - The color textbox id
	 * @param {string} [color] - The current color (e.g #000000)
	 * @param {object} [options] - The color picker options
	 * @returns {function}
	 */
	function initColorPicker(id, color, options) {
		if (!id) {return null;}
		var opts = {};
		$.extend(opts, options);
		if (typeof color === 'string') {opts.color = color;}
		return function() {
			$('#' + id).spectrum(opts);
		};
	}

	/**
	 * Handler for the spinner change event
	 */
	function onSpinnerChange() {
		var $spinner = $(this);
		var value = $spinner.spinner('value');

		// If the value is null and the real value in the textbox is string we empty the textbox
		if (value === null && typeof $spinner.val() === 'string') {
			$spinner.val('');
			return;
		}

		// Now check that the number is in the min/max range.
		var min = $spinner.spinner('option', 'min');
		var max = $spinner.spinner('option', 'max');
		if (typeof min === 'number' && this.value < min) {
			this.value = min;
			return;
		}

		if (typeof max === 'number' && this.value > max) {
			this.value = max;
		}
	}
})(window.$);
