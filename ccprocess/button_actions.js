/*************************************************
*  button_actions.js
*  script containing button actions
*  12/12/17
*
*************************************************/

function showVersion() {
	var script_name = "button_actions.js";
	var script_version = "1.0.0";
	console.log("script:" + script_name + " version:" + script_version);
}
showVersion();

$("#show_token").click(function (e) {
	showTestResults(token);
});

$("#change_card_button").click(function (e) {
	hideErrorDisplay();
	hideProcessState();
	displayExistingCardElements();
});

$("#new_card_button").click(function (e) {
	hideErrorDisplay();
	hideProcessState();
	clearNewCardData();
	displayNewCardElements();
	$('#close_button_wrapper').css("margin-top","")
});

$("#existing_cards_button").click(function (e) {
	hideErrorDisplay();
	hideProcessState();
	displayExistingCardElements();
});

$("#expiry").focus(function (e) {
	$("#expiry").css("color", "initial");
	$("#expiry").val("");
});

$("#submit_card").click(function (e) {
	hideErrorDisplay();
	if ($("#cardholder_country").val().length != 2) {
		displayError("Country must be two letters");
		$("#cardholder_country").focus();
		return;
	}
	if ($("#expiry").val().length != 4 || $("#expiry").val().indexOf("MMYY") > -1 || $("#expiry").val().indexOf("/") > -1) {
		displayError("Expiry must of the format 'MMYY'");
		$("#expiry").focus();
		return;
	}
	if ($("#cardholder_name").val().length == 0) {
		displayError("Name must be populated");
		$("#cardholder_name").focus();
		return;
	}
	if (properties.require_address) {
		var v_results = validateAddress($("#cardholder_addy").val());
		if (!v_results.isValid) {
			displayError(v_results.message);
			$("#cardholder_addy").focus();
			return;
		}
		v_results = validateCity($("#cardholder_city").val());
		if (!v_results.isValid) {
			displayError(v_results.message);
			$("#cardholder_city").focus();
			return;
		}
		v_results = validateState($("#cardholder_region").val());
		if (!v_results.isValid) {
			displayError(v_results.message);
			$("#cardholder_region").focus();
			return;
		}
		v_results = validatePostalCode($("#cardholder_postal_code").val());
		if (!v_results.isValid) {
			displayError(v_results.message);
			$("#cardholder_postal_code").focus();
			return;
		}
	}
	if (properties.require_phone) {
		var v_results = validatePhoneNumber($("#cardholder_phone").val());
		if (!v_results.isValid) {
			displayError(v_results.message);
			$("#cardholder_phone").focus();

		}
	}
	if (properties.require_email) {
		var v_results = validateEmail($("#cardholder_email").val());
		if (!v_results.isValid) {
			displayError(v_results.message);
			$("#cardholder_email").focus();
			return;
		}
	}
	validateAuthOrCaptureCardInOneCall("auth", "0");
});

$("#add_card").click(function (e) {
	if ("" === token) {
		var error_msg = "You haven't retrieved a token for the card yet. Place the mouse " +
			"cursor in the \"Encrypted Card data\" field and enter the card number on the keypad.";
		console.log(error_msg);
		displayError(error_msg);
		return;
	}
	addCardToProfileProcess();
});

$("#use_card").click(function (e) {
	attachCardToOrder();
});

// parent-level event handler for the  buttons on the accounts table. Have to do it this
// way, versus at the buttons level, to accommodate addition of rows to the table
// should someone add a card, thus adding a row to the table, and then subsequently
// wanting to delete the card (maybe name was entered incorrectly or something)
$("#accounts_table").on('click', 'button', function (e) {
	var parts = e.currentTarget.id.split("_");
	console.log("Deleting id: " + parts[1] + " (corresponding to token:" + parts[2] + ") from profile " + cardservices_profile_id);
	deleteCardFromProfileProcess(parts[1], parts[2]);
});

$("#clear_card_data").click(function (e) {
	clearNewCardData();
});

$("#temp_customer_id_setter").click(function (e) {
	cardservices_profile_id = $("#temp_customer_id").val();
	getAccounts();
	$("#accounts_display").show();
});

$("#temp_orno_setter").click(function (e) {
	orno = $("#temp_orno").val();
});

$("#temp_cuno_setter").click(function (e) {
	cuno = $("#temp_cuno").val();
});

$("#close_button").click(function (e) {
	closeWindow();
});

$("#check_api_invocation").click(function (e) {
	checkM3Api();
});

$("#auth0_option").click(function (e) {
	hideErrorDisplay();
	hideProcessState();
	$("#card_action_button").text("Authorize with $0");
	$("#cc_actions_button_wrapper").show();
});

$("#authActual_option").click(function (e) {
	hideErrorDisplay();
	hideProcessState();
	$("#card_action_button").text("Authorize with actual $");
	$("#cc_actions_button_wrapper").show();
});

$("#refund_option").click(function (e) {
	hideErrorDisplay();
	hideProcessState();
	$("#card_action_button").text("Refund Card");
	$("#cc_actions_button_wrapper").show();
});

$("#capture_option").click(function (e) {
	hideErrorDisplay();
	hideProcessState();
	$("#card_action_button").text("Capture Funds");
	$("#cc_actions_button_wrapper").show();
});

$("#void_option").click(function (e) {
	hideErrorDisplay();
	hideProcessState();
	$("#card_action_button").text("Void Transaction");
	$("#cc_actions_button_wrapper").show();
});

$("[id^='reset_button']").click(function (e) {
	showCCOptions();
});

$("#card_action_button").click(function (e) {
	if ($("input[id='refund']:checked").val()) {
		confirmAction("Refund funds to the card?", "refund", "hide_cc_actions_button", "Refund Confirmation");
	} else if ($("input[id='capture']:checked").val()) {
		confirmAction("Capture funds?", "capture", "hide_cc_actions_button", "Capture Confirmation");
	} else if ($("input[id='authW0']:checked").val()) {
		confirmAction("Authorize for $0?", "authW0", "hide_cc_actions_button", "Authorization Confirmation");
	} else if ($("input[id='authWActual']:checked").val()) {
		var orderAmount = "0";
		if (!ordersDict[orno]) {
			order_data = getOrderHeadData();
			orderAmount = order_data.orderAmount;
		} else {
			orderAmount = ordersDict[orno].orderAmount;
		}
		confirmAction("Authorize for $" + orderAmount + "?", "authWActual", "hide_cc_actions_button", "Authorization Confirmation");

	} else if ($("input[id='void']:checked").val()) {
		confirmAction("Void the transaction for this card?", "void", "hide_cc_actions_button", "Void Confirmation");
	} else {
		error_msg = "You must select one of the Credit Card processing options; e.g. Capture, Refund, Auth w/0, ....";
		displayError(error_msg);
	}
});

$("#capture_card").click(function (e) {
	// DELETE ME, I think
	captureCardProcess();
});

$("#prompt_confirmation_button").click(function (e) {
	myConfirm('Do you want to delete this record ?', function () {
		alert('You clicked OK');
	}, function () {
		alert('You clicked Cancel');
	},
		'Confirm Delete'
	);
});