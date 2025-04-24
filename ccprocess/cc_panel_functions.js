/*************************************************
*  cc_panel_functions.js
*  script containing button actions
*  12/12/17
*
*************************************************/
if (getValidToken == undefined) {
	var getValidToken = () => {
	  return new Promise((resolve, reject) => {
		let csrfToken = sessionStorage.getItem('csrfToken')
		csrfToken = csrfToken == null ? '' : csrfToken
		let csrfTimestamp = sessionStorage.getItem('csrfTimestamp')
		csrfTimestamp = csrfTimestamp == null ? 0 : parseInt(csrfTimestamp)
		let now = new Date().getTime()
		if ((csrfTimestamp + 30000) > now) {
		  resolve(csrfToken)
		} else {
		  const req = {
			method: 'GET',
			url: '/m3api-rest/csrf',
			cache: false
		  }
		  $.ajax(req).then(
			function (resp) {
			  var csrfToken = resp
			  csrfTimestamp = now
			  sessionStorage.setItem('csrfToken', csrfToken)
			  sessionStorage.setItem('csrfTimestamp', csrfTimestamp)
			  console.log("csrf token is " + csrfToken)
			  resolve(csrfToken)
			},
			function (err) {
			  reject(err)
			}
		  )
		}
	  })
	}
  }
function showVersion() {
	var script_name = "cc_panel_functions.js";
	var script_version = "1.0.0";
	console.log((new Date()).toISOString() + ": script:" + script_name + " version:" + script_version);
}
showVersion();

//*************************** Process Flow functions ****************************************
function displayCardOptions(allowChange) {
	if (allowChange) {
		$("#card_options_wrapper").show();
		$("#new_card_button").show();
		if ("" != cardservices_profile_id) {
			$("#change_card_button").show();
			$("#existing_cards_button").show();
		} else {
			$("#change_card_button").hide();
			$("#existing_cards_button").hide();
		}
	} else {
		$("#card_options_wrapper").hide();
	}
}

async function addCardToProfileProcess() {
	displayProcessState("Adding card to profile...");
	await addCard();
	hideProcessState();
}

async function deleteCardFromProfileProcess(account_id, token) {
	displayProcessState("Deleting card having id of " + account_id + " from profile " + cardservices_profile_id);
	await deleteCard(account_id, token);
	hideProcessState();
}

async function updateOrderCardProcess(amount, new_retref) {
	var result = {};
	// need to see if there was already a card associated with this order and, if so,
	// void any previous transactions
	var authData = await getCardAuthDataFromExtensionTables();
	if (authData.transaction_status != null &&
		$("input[name='selected_card']:checked").prop('id') &&
		$("input[name='selected_card']:checked").prop('id') != authData.token &&
		authData.transaction_status.indexOf("VOID") === -1 &&
		authData.transaction_status.indexOf("CAPTURE") === -1) {
		// changing cards and previous transaction wasn't a VOID or a CAPTURE
		result = voidTransactionProcess(authData.retref);
	} else if ("" === token && "" === associatedToken) {
		token = associatedToken = $("input[name='selected_card']:checked").prop('id');
	}
	result = await updateOrderCard(amount, new_retref);
	if (!result.wasSuccessful) {
		var error_msg = result.message;
		displayError("On updateOrderCardProcess, Error:" + error_msg);
		return result;
	}
}

async function refundCardProcess() {
	var result = {};
	if (!$("#refund:checked").val()) {
		var message = "You must select the \"Refund\" radio button to refund funds.";
		displayError(message);
		return result;
	}
	var authData = await getCardAuthDataFromExtensionTables();
	if (authData.retref) {
		result = await refundCard(authData.amount, authData.retref);
		console.log((new Date()).toISOString() + ": refund results:" + JSON.stringify(result, null, 2));
		await persistCardAuthData("refund");
		if (!result.wasSuccessful) {
			var error_msg = result.message;
			displayError("On refundCardProcess, error:" + error_msg);
			return;
		}
	} else {
		console.log((new Date()).toISOString() + ": No authorization data for orno; can't refund anything.");
		showCCOptions("No Associated Card");
	}
}

async function captureCardProcess() {
	var result = {};
	if (!$("#capture:checked").val()) {
		var message = "You must select the \"Capture\" radio button to capture funds.";
		displayError(message);
		return result;
	}
	authData = await getCardAuthDataFromExtensionTables();
	result = await captureCard(authData.retref, null);
	result = await persistCardAuthData("capture");
	if (result.wasSuccessful) {
		// display the results in case we can't close the window
		displayProcessState("Successfully captured funds.");
		closeWindow();
	} else {
		var error_msg = result.status;
		displayError("On captureCardProcess, error:" + error_msg);
		showCCOptions("Authorized");
	}
}

async function voidTransactionProcess(retrefToVoid) {
	var result = {};
	var authData = {};

	if (!retrefToVoid) authData = await getCardAuthDataFromExtensionTables();
	else authData.retref = retrefToVoid;
	if (authData.retref) {
		await voidTransaction(authData.retref);
		console.log((new Date()).toISOString() + ": void results:" + JSON.stringify(result, null, 2));
		await persistCardAuthData("void");
	} else {
		var error_msg = "No retref for orno; can't void.";
		console.log((new Date()).toISOString() + ": " + error_msg);
		displayError("On voidTransactionProcess, error:" + error_msg);
		showCCOptions("No Associated Card");
	}
}

async function updateOrderCard(amount, new_retref) {
	var result = {};
	if (!($("input[name='selected_card']:checked").val() || "" != associatedToken)) {
		displayError("You must select a card.");
		result.wasSuccessful = false;
		result.message = "No card is associated with the order - please select one.";
		return result;
	}
	var selected_token = "";
	if ($("input[name='selected_card']:checked").val()) {
		selected_token = $("input[name='selected_card']:checked").prop('id');
		expiry = $("#expiry_" + selected_token).html(); // for the persistence to m3 call
		accttype = $("#acctType_" + selected_token).html();
	} else {
		selected_token = associatedToken;
		for (var i = 0; i < accounts.length; i++) {
			if (accounts[i].token === associatedToken) {
				expiry = accounts[i].expiry;
				accttype = accounts[i].accttype;
				token = accounts[i].token;
				break;
			}
		}
	}
	console.log((new Date()).toISOString() + ": selected card having token " + selected_token + " for order.");
	console.log((new Date()).toISOString() + ": expiry of selected card: " + expiry);
	// need to auth the card with zero amount to get retref, authcode
	//result = validateAuthOrCaptureCardInOneCall("auth", amount);
	//if(!result.wasSuccessful) {
	//return result.wasSuccessful;
	//} else {
	displayProcessState("Persisting authorization data...");
	// persist retref and authcode to extension table
	token = selected_token;
	result = await persistCardAuthData("auth");
	if (result.wasSuccessful) {
		newCardAppliedToOrder = true;
		associatedToken = selected_token;
		buildAccountsTables(accounts);
	} else {
		var error_msg = "There was an error persisting card authorization data to M3 for " + orno;
		console.log((new Date()).toISOString() + ": " + error_msg);
		displayError("On update ordercard, error:" + error_msg);
		return result;
	}
	//}
	var inquire_result = await inquire(new_retref);
	showCCOptions(inquire_result.status);
	hideProcessState();
	return result;
}

function closeWindow() {
	console.log((new Date()).toISOString() + ": closing CC window");
	var card = "";
	if (newCardAppliedToOrder) {
		card = accttype + " ****" + $("#last4_" + token).html();
	}
	accounts_loaded = false; // shouldn't be necessary, but let's set to ensure
	if (window.opener != null) {
		window.opener.sessionStorage.setItem(orno + "_card_used", card);
		if (properties.allow_window_close) window.close();
	}

}

//*************************** CardConnect-targeted functions ****************************************
async function getAccounts() {
	if (accounts_loaded && !reload) return;
	var get_accounts_url = properties.cardservices_getprofile_uri +
		"/" + cardservices_profile_id + "/" +
		cardconnect_account_id + "/" +
		properties.cardconnect_merchant_id;

	console.log((new Date()).toISOString() + ": get accounts url: " + get_accounts_url);
	let request = {
		url: get_accounts_url,
		method: "GET",
		cache: true,
		headers: {
			"content-type": "application/json"
		}
	};
	await IonApiService.Current.execute(request).then(response => {
		json = response.data
		console.log((new Date()).toISOString() + ":" + JSON.stringify(json, null, 2));
		if ("Profile not found" === json[0].resptext) {
			var error_msg = "Profile not found";
			console.log((new Date()).toISOString() + ": " + error_msg);
			displayError("on getAccounts, error:" + error_msg);
		} else {
			accounts = json;
			buildAccountsTables(accounts);
		}
		accounts_loaded = true;
	}).catch(err => {
		var error = JSON.stringify(err, null, 2);
		console.log((new Date()).toISOString() + ": AJAX error in request: " + error);
		var error_msg = "There was an error trying to retrieve account data. The error message is: " + error;
		displayError("on getAccounts, fail:" + error_msg);
	})
}
function validateAuthOrCaptureCardInOneCall(valAuthOrCapture, amount) {
	hideErrorDisplay();
	var result = {};
	var order_data = {};
	if ("" === token) {
		var error_msg = "You haven't retrieved a token for the card yet. Place the mouse " +
			"cursor in the \"Encrypted Card data\" field and enter the card number on the keypad.";
		console.log((new Date()).toISOString() + ": " + error_msg);
		displayError("On validateAuthOrCaptureCardInOneCall, error:" + error_msg);
		result.wasSuccessful = false;
		return result;
	}
	var authEndpoint_request = {}
	authEndpoint_request.name = $("#cardholder_name").val();
	authEndpoint_request.address = $("#cardholder_addy").val();
	authEndpoint_request.city = $("#cardholder_city").val();
	authEndpoint_request.region = $("#cardholder_region").val();
	authEndpoint_request.postal = $("#cardholder_postal_code").val();
	authEndpoint_request.country = $("#cardholder_country").val();
	authEndpoint_request.phone = $("#cardholder_phone").val();
	authEndpoint_request.email = $("#cardholder_email").val();
	authEndpoint_request.expiry = $("#expiry").val();
	if ("validate" === valAuthOrCapture) {
		authEndpoint_request.amount = 0;
	} else if ("auth" === valAuthOrCapture) {
		authEndpoint_request.orderid = orno;
		authEndpoint_request.userfields = "[{\"CustomerNumber=\"" + cuno + "\"},{\"OrderNumber=\"" + orno + "\"}]";

		// if auth is permitted only for zero amount, automatically set it; if only permitted for
		// actual amount, automatically set it; otherwise, if either are permitted, make sure one
		// is select and use that Value
		if (!amount && properties.allow_actualamt_auth) {
			order_data = getOrderHeadData();
			authAmount = order_data.orderAmount;
			currency = order_data.cucd;
		} else {
			authAmount = calculateAuthAmount();
		}
		console.log((new Date()).toISOString() + ": authorizing " + token + " for: " + authAmount);
	} else if ("capture" === valAuthOrCapture) {
		// need to do an all-in-one thing. Actually - just capture straight away
		authEndpoint_request.capture = "Y";
		authEndpoint_request.expiry = expiry;
	}
	authEndpoint_request.amount = ensureDecimal(authAmount);
	authEndpoint_request.currency = currency;
	authEndpoint_request.merchid = properties.cardconnect_merchant_id;
	authEndpoint_request.account = token;


	var request_body = JSON.stringify(authEndpoint_request);
	console.log((new Date()).toISOString() + ": " + request_body);
	var valAuthOrCapture_url = properties.cardservices_auth_uri;
	console.log((new Date()).toISOString() + ": valAuthOrCapture_url url: " + valAuthOrCapture_url);

	$('.loading').show(callAjax);
	async function callAjax() {
		//check how to replace later
		let request = {
			url: valAuthOrCapture_url,
			method: "PUT",
			headers: {
				"content-type": "application/json"
			},
			data: request_body
		};
		await IonApiService.Current.execute(request).then(resp => {
			json = resp.data
			hideLoading();
			retref = json.retref;
			respstat = json.respstat;
			resptext = json.resptext;
			authcode = json.authcode;
			console.log((new Date()).toISOString() + ": " + valAuthOrCapture + " results:");
			console.log((new Date()).toISOString() + ": " + JSON.stringify(json, null, 2));
			if ("A" === json.respstat) {
				result.wasSuccessful = true;
				// add the new card to the accounts table
				var this_card = {};
				this_card.accttype = "Unknown";
				this_card.token = token;
				this_card.expiry = authEndpoint_request.expiry;
				this_card.name = authEndpoint_request.name;
				this_card.defaultacct = "N";
				accounts = [];
				accounts.push(this_card);
				buildAccountsTables(accounts);
				if ("validate" === valAuthOrCapture) {
					// it's valid - let's give user option to add it to the profile
					console.log((new Date()).toISOString() + ": Validation of " + token + " was successful");
					if ("" === cardservices_profile_id) {
						if (properties.persist_profile_id) {
							// we don't have a profile id for this customer, but DO want to create
							// and save one
							$("#add_card").text("Create Customer Profile and add card as default");
							$("#submit_card").switchClass("ccprocess-logical-next", "ccprocess-button");
							$("#add_card").switchClass("ccprocess-button", "ccprocess-logical-next");
							$("#add_card_wrapper").fadeIn();
						}
					} else {
						// we have a profileId - it may have come from the customer extension table
						// and it may have come from the order extension table but we don't really
						// care - we'll save this card to the profile
						result = addCardToProfileProcess();
						displayExistingCardElements();
						showCCOptions("Zero Amount");
						displayCardOptions(canChangeCard);
					}

				} else if ("auth" === valAuthOrCapture) {
					// we're authorizing, which means we want to add the retref and authcode (and some other fields)
					// to the order in M3
					console.log((new Date()).toISOString() + ": Authorization of " + token + " was successful");
					result.retref = json.retref;
					// we don't have a profile id for this customer and we don't want to save one
					// so we want to just attach the card to the order and move on
					associatedToken = token;
					expiry = authEndpoint_request.expiry;
					$("input[name='selected_card'][id='" + token + "']").click();
					// note: the following call is to some degree recursive as it results in
					// the invocation of this method.
					updateOrderCardProcess(authAmount, json.retref);
					displayAssociatedCardElements();
					showCCOptions("Zero Amount");
					displayCardOptions(canChangeCard);
					displayAssociatedCardElements();
				} else if ("capture" === valAuthOrCapture) {
					// we're authorizing, which means we want to add the retref and authcode (and some other fields)
					// to the order in M3
					console.log((new Date()).toISOString() + ": Capture of " + token + " was successful");
					displayAssociatedCardElements();
				}
				hideErrorDisplay();
				hideProcessState();
			} else {
				console.log((new Date()).toISOString() + ": Validation of " + token + " was unsuccessful");
				$("#add_card_wrapper").fadeOut();
				hideProcessState();
				displayError("On validateAuthOrCaptureCardInOneCall, Validation or authorization of card was unsuccessful. Reason: " + resptext + ". Please ask customer for a new card");
			}
		}).catch((err) => {
			hideLoading();
			var error = JSON.stringify(err, null, 2);
			console.log((new Date()).toISOString() + ": AJAX error in request: " + error);
			var error_msg = "There was an error trying to retrieve account data. The error message is: " + error;
			displayError("On validateAuthOrCaptureCardInOneCall, fail:" + error_msg);
			result.wasSuccessful = false;
			return result;
		})
		hideLoading();// end of .fail
		return result
	}
}

async function addCard() {
	var result = {};
	var add_card_request = {}
	add_card_request.merchid = properties.cardconnect_merchant_id;
	add_card_request.account = token;
	add_card_request.expiry = $("#expiry").val();
	add_card_request.name = $("#cardholder_name").val();
	add_card_request.address = $("#cardholder_addy").val();
	add_card_request.city = $("#cardholder_city").val();
	add_card_request.region = $("#cardholder_region").val();
	add_card_request.postal = $("#cardholder_postal_code").val();
	add_card_request.country = $("#cardholder_country").val();
	add_card_request.phone = $("#cardholder_phone").val();

	var add_card_url = "";

	if ("" === cardservices_profile_id) {
		// this is a new customer
		add_card_request.defaultacct = "Y";
		add_card_url = properties.cardservices_createprofile_uri;
	} else {
		// existing customer - add card to profile
		add_card_request.profile = cardservices_profile_id;
		add_card_request.profileupdate = "Y";
		add_card_url = properties.cardservices_updateprofile_uri;
	}
	var request_body = JSON.stringify(add_card_request);
	console.log((new Date()).toISOString() + ": " + add_card_request);
	console.log((new Date()).toISOString() + ": add card url: " + add_card_url);
	let request = {
		url: add_card_url,
		method: "PUT",
		headers: {
			"content-type": "application/json"
		},
		data: request_body
	};
	await IonApiService.Current.execute(request).then(async resp => {
		json = resp.data
		console.log((new Date()).toISOString() + ": addCard results:");
		console.log((new Date()).toISOString() + ": " + JSON.stringify(json, null, 2));
		result.wasSuccessful = true;
		if ("" === cardservices_profile_id) {
			console.log((new Date()).toISOString() + ": Successfully created card connect profile for " + cuno + "; it is: " + json.profileid);
			console.log((new Date()).toISOString() + ": " + JSON.stringify(json, null, 2));
			cardservices_profile_id = json.profileid;
			// now need to persist profileid to the OCUSMA extension table
			if (properties.persist_profile_id) {
				result = await persistProfileIdToM3(cuno, cardservices_profile_id, "add");
			}
		} else {
			console.log((new Date()).toISOString() + ": Successfully added token " + token + " to profile " + cardservices_profile_id);
			console.log((new Date()).toISOString() + ": " + JSON.stringify(json, null, 2));
		}
		// add the new card to the accounts table
		var this_card = {};
		this_card.acctid = json.acctid;
		this_card.accttype = json.accttype;
		this_card.token = json.token;
		this_card.expiry = json.expiry;
		this_card.name = json.name;
		this_card.defaultacct = json.defaultacct;
		accounts.push(this_card);
		buildAccountsTables(accounts);
		displayExistingCardElements();
	}).catch((err) => {
		console.log(err)
	})
	return result;
}

async function deleteCard(account_id, token) {
	var result = {};
	var delete_account_url = properties.cardservices_getprofile_uri +
		"/" + cardservices_profile_id + "/" +
		account_id + "/" +
		properties.cardconnect_merchant_id;

	console.log((new Date()).toISOString() + ": delete account url: " + delete_account_url);
	let request = {
		url: delete_account_url,
		method: "DELETE",
		headers: {
			"content-type": "application/json"
		},
	};
	await IonApiService.Current.execute(request).then(resp => {
		json = resp.data
		console.log((new Date()).toISOString() + ": deleteCard result:");
		console.log((new Date()).toISOString() + ": " + JSON.stringify(json, null, 2));
		if ("A" != json.respstat) {
			// I think that resptext="Invalid Field" may mean the default account can't be deleted.
			var error_msg = "Deletion error: " + json.resptext;
			console.log((new Date()).toISOString() + ": " + error_msg);
			displayError("On deletecard, error:" + error_msg);
			result.wasSuccessful = false;
		} else {
			result.wasSuccessful = true;
			var deletion_index = -1;
			for (var i = 0; i < accounts.length; i++) {
				if (accounts[i].acctid = account_id) deletion_index = i;
			}
			if (deletion_index != -1) accounts.splice(deletion_index, 1);
			buildAccountsTables(accounts);
		}
	}).catch((err) => {
		var error = JSON.stringify(err, null, 2);
		console.log((new Date()).toISOString() + ": AJAX error in request: " + error);
		var error_msg = "There was an error trying to retrieve account data. The error message is: " + error;
		displayError("On add card, fail" + error_msg);
		result.wasSuccessful = false;
	})
	return result;
}

async function refundCard(amount, retref) {
	var result = {};
	var refund_account_url = properties.cardservices_refund_uri;

	console.log((new Date()).toISOString() + ": refund account url: " + refund_account_url);

	var refund_card_request = {}
	refund_card_request.merchid = properties.cardconnect_merchant_id;
	refund_card_request.amount = amount;
	refund_card_request.retref = retref;
	let request = {
		url: refund_account_url,
		method: "PUT",
		headers: {
			"content-type": "application/json"
		},
		data: JSON.stringify(refund_card_request)
	};
	await IonApiService.Current.execute(request).then(resp => {
		json = resp.data
		console.log((new Date()).toISOString() + ": refundCard results:");
		console.log((new Date()).toISOString() + ": " + JSON.stringify(json, null, 2));
		respstat = json.respstat;
		resptext = json.resptext;
		if ("A" === json.respstat) {
			result.wasSuccessful = true;
			console.log((new Date()).toISOString() + ": Refund of " + retref + " was successful");
			hideErrorDisplay();
			hideProcessState();
			showCCOptions("Refunded");
		} else if ("C" === json.respstat) {
			result.wasSuccessful = false;
			result.message = "Refund was unsuccessful; message:" + json.resptext;
			console.log((new Date()).toISOString() + ": Refund of " + retref + " was unsuccessful; message:" + json.resptext);
			hideProcessState();
			hideCCActionsButton();
			hideRefundOption();
			displayError("On refundcard, Refund of card was unsuccessful. CardConnect Message: " + json.resptext);
		}
	}).catch((err) => {
		var error = JSON.stringify(err, null, 2);
		console.log((new Date()).toISOString() + ": AJAX error in request: " + error);
		var error_msg = "There was an error trying to refund a card. The error message is: " + error;
		displayError("On refundcard, fail:" + error_msg);
		result.wasSuccessful = false;
		showCCOptions("Captured");
	})
	return result;
}

async function captureCard(retref, amount) {
	var result = {};
	if ("" === retref) {
		if (!amount) {
			result.status = "Amount can not be null if trying to capture funds when no retref exists.";
			return result;
		}
		return await validateAuthOrCaptureCardInOneCall("capture", amount);
	}

	var capture_card_url = properties.cardservices_capture_uri;

	console.log((new Date()).toISOString() + ": capture card url: " + capture_card_url);

	var capture_card_request = {}
	capture_card_request.merchid = properties.cardconnect_merchant_id;
	if (amount) capture_card_request.amount = amount;
	capture_card_request.retref = retref;
	let request = {
		url: capture_card_url,
		method: "PUT",
		headers: {
			"content-type": "application/json"
		},
		data: JSON.stringify(capture_card_request),
	};
	await IonApiService.Current.execute(request).then(resp => {
		json = resp.data
		console.log((new Date()).toISOString() + ": captureCard results:");
		console.log((new Date()).toISOString() + ": " + JSON.stringify(json, null, 2));
		result.wasSuccessful = true;
		if ("Accepted" === json.setlstat) {
			respstat = "A"; // for use in persistCardData
			resptext = json.setlstat; // for use in persistCardData
			result.wasSuccessful = true;
			result.status = "Accepted";
			console.log((new Date()).toISOString() + ": Capture of " + retref + " was successful");
			hideErrorDisplay();
			hideProcessState();

		} else if ("Authorized" === json.setlstat) {
			respstat = "A"; // for use in persistCardData
			resptext = json.setlstat; // for use in persistCardData
			result.status = "Authorized";
			error_msg = "Capture of " + retref + " was unsuccessful - card was only authorized";
			console.log((new Date()).toISOString() + ": " + error_msg);
			displayError("On capturecard, " + error_msg);

		} else if ("Queued for Capture" === json.setlstat) {
			respstat = "A"; // for use in persistCardData
			resptext = json.setlstat; // for use in persistCardData
			result.status = "Queued for Capture";
			console.log((new Date()).toISOString() + ": Capture of " + retref + " was queued. ");
			hideErrorDisplay();
			hideProcessState();

		} else if ("Zero Amount" === json.setlstat) {
			respstat = "A"; // for use in persistCardData
			resptext = json.setlstat; // for use in persistCardData
			result.status = "Capture was voided";
			var error_msg = "Capture of " + retref + " was voided";
			console.log((new Date()).toISOString() + ": " + error_msg);
			displayError("On capturecard, " + error_msg);

		} else if ("Txn not found" === json.setlstat) {
			respstat = "C"; // for use in persistCardData
			resptext = json.setlstat; // for use in persistCardData
			result.status = "Txn not found";
			var error_msg = "Capture of " + retref + " was unsuccessful - response is: \"The Retref was not found\"";
			console.log((new Date()).toISOString() + ": " + error_msg);
			displayError("On capturecard, " + error_msg);

		} else if ("Rejected" === json.setlstat) {
			respstat = "C"; // for use in persistCardData
			resptext = json.setlstat; // for use in persistCardData
			result.wasSuccessful = false;
			result.status = "Rejected";
			var error_msg = "Capture of " + retref + " was rejected";
			console.log((new Date()).toISOString() + ": " + error_msg);
			displayError("On capturecard, " + error_msg);
		}
		showCCOptions(json.setlstat);
	}).catch(err => {
		var error = JSON.stringify(err, null, 2);
		console.log((new Date()).toISOString() + ": AJAX error in request: " + error);
		var error_msg = "There was an error trying to capture a card. The error message is: " + error;
		displayError("On capturecard, fail: " + error_msg);
		result.wasSuccessful = false;
	})
	return result;
}

async function inquire(retref) {
	var result = {};
	if (!retref || "" === retref) return result;
	var inquire_url = properties.cardservices_inquire_uri + "/" + retref + "/" + properties.cardconnect_merchant_id;
	console.log((new Date()).toISOString() + ": inquire url: " + inquire_url);
	let request = {
		url: inquire_url,
		method: "GET",
		cache: true,
		headers: {
			"content-type": "application/json"
		}
	};
	await IonApiService.Current.execute(request).then(resp => {
		json = resp.data
		console.log((new Date()).toISOString() + ": Inquire results:");
		console.log((new Date()).toISOString() + ": " + JSON.stringify(json, null, 2));
		result.wasSuccessful = true;
		result.status = json.setlstat;
		hideErrorDisplay();
		hideProcessState();
		showCCOptions(json.setlstat);
	}).catch(err => {
		var error = JSON.stringify(err, null, 2);
		console.log((new Date()).toISOString() + ": AJAX error in request: " + error);
		var error_msg = "There was an error trying to refund a card. The error message is: " + error;
		displayError("On inquire, fail:" + error_msg);
		result.wasSuccessful = false;
		result.status = error_msg;
	})
	return result;
}

async function voidTransaction(retref) {
	var result = {};
	var void_url = properties.cardservices_void_uri;
	console.log((new Date()).toISOString() + ": void url: " + void_url);

	var void_card_request = {};
	void_card_request.retref = retref;
	void_card_request.merchid = properties.cardconnect_merchant_id;
	let request = {
		url: void_url,
		method: "PUT",
		headers: {
			"content-type": "application/json"
		},
		data: JSON.stringify(void_card_request)
	};
	await IonApiService.Current.execute(request).then(response => {
		json = response.data
		console.log((new Date()).toISOString() + ": void results:");
		console.log((new Date()).toISOString() + ": " + JSON.stringify(json, null, 2));
		result.wasSuccessful = true;
		result.status = json.respstat;
		respstat = json.respstat; // for persistCardAuthData
		resptext = json.resptext; // for persistCardAuthData
		if ("A" === json.respstat) {
			console.log((new Date()).toISOString() + ": Void of " + retref + " was successful; results: " + json.respstat);
			hideErrorDisplay();
			hideProcessState();
			showCCOptions("Zero Amount");
		} else {
			var error_msg = "Void of " + retref + " was unsuccessful; results: " + json.respstat;
			console.log((new Date()).toISOString() + ": " + error_msg);
			displayError("On voidTransaction, " + error_msg);
			result.wasSuccessful = false;
			result.status = error_msg;
		}
	}).catch((err) => {
		var error = JSON.stringify(err, null, 2);
		console.log((new Date()).toISOString() + ": AJAX error in request: " + error);
		var error_msg = "There was an error trying to refund a card. The error message is: " + error;
		displayError("On voidTransaction, fail: " + error_msg);
		result.wasSuccessful = false;
		result.status = error_msg;
		showCCOptions("Not sure");
	})
	return result;
}

//*************************** M3-targeted functions ****************************************

async function persistCardAuthData(action) {
	var result = {};
	if (!properties.useM3) {
		result.wasSuccessful = true;
		return result;
	}
	var now = new Date();
	authdate = formatDate(now);
	var pcad_url = properties.m3_xtend_table_uri;
	if (orderAlreadyHasCard) {
		pcad_url += properties.m3_change_auth_value_uri;
	} else {
		pcad_url += properties.m3_add_auth_value_uri;
	}
	var card_transaction_status = "FRONTEND|" + action.toUpperCase() + "|" + respstat + "|" + resptext;
	var record = {
		cono : cono,
		divi : divi,
		ORNO : orno,
		TOKN : encodeURIComponent(token),
		ATYP : encodeURIComponent(accttype),
		EXP0 : expiry,
		REFN : retref,
		AUTS : encodeURIComponent(authdate),
		AUCD : authcode,
		STAT : encodeURIComponent(card_transaction_status),
		CCAA : authAmount
	};
	await callM3API_V2(pcad_url,record).then(function(response) {
		result.wasSuccessful = true;
	}).catch(function(error) {
		console.log((new Date()).toISOString() + ": " + error);
		displayError("On persistcardauthdata , fail:" + error);
		result.wasSuccessful = false;
	})
	return result;
}
async function persistProfileIdToM3(cuno, cardservices_profile_id, addOrChange) {
	var result = {};
	if (!properties.persist_profile_id) {
		result.status = "Profile data is not persisted to M3 in this environment.";
		return result;
	}
	var add_profile_id_url = properties.m3_extension_table_uri;

	if ("add" === addOrChange) add_profile_id_url += properties.m3_add_field_value_uri;
	else if ("change" === addOrChange) add_profile_id_url += properties.m3_change_field_value_uri;
	var record = {
		cono : cono,
		divi : divi,
		FILE : "OCUSMA00",
		PK01 : cuno,
		A430 : cardservices_profile_id
	};
	await callM3API_V2(add_profile_id_url,record).then(async function(response) {
		console.log((new Date()).toISOString() + ": successfully added profileId " + cardservices_profile_id + " to cuno " + cuno);
		result.wasSuccessful = true;
	}).catch(async function(error) {
		if (error != null && error.indexOf("The record already exists") > -1) {
			console.log((new Date()).toISOString() + ": There is already an extension table entry for cuno:" + cuno + "; changing m3api invocation to ChgFieldValue");
			result = await persistProfileIdToM3(cuno, cardservices_profile_id, "change");
			result.wasSuccessful = true;
		}else{
			result.wasSuccessful = false;
			console.log((new Date()).toISOString() + ": " + error);
			displayError("on persistProfileIdToM3, fail:" + error);
		}
	})
	return result;
}
function getProfileIdFromExtensionTables(cuno) {
	if (!properties.persist_profile_id) return;
	// first, get the CardConnect profileId
	var get_fv_url = properties.m3_extension_table_uri +
		properties.m3_get_field_value_uri;
	var querystring = "";
	var record = {
		cono : cono,
		divi : divi,
		FILE : "OCUSMA00",
		PK01 : cuno
	};
	callM3API_V2(get_fv_url,record).then(async function(response) {
		cardservices_profile_id = response["A430"];
		console.log((new Date()).toISOString() + ": cuno:" + cuno + " cardservices_profile_id:" + cardservices_profile_id);
	}).catch(async function(error) {
		if (error != null && error.indexOf("The record already exists") > -1) {
			console.log((new Date()).toISOString() + ": No cardservices_profile_id associated with cuno:" + cuno);
		}
	})
}
async function getCardAuthDataFromExtensionTables() {
	var authData = {};
	if (!properties.useM3) {
		authData.expiry = "0920";
		authData.token = "111111111";
		authData.authdate = "121717";
		authData.transaction_status = "A";
		authData.retref = "343005123105";
		authData.amount = "1234.56";
		return authData;
	}
	// first, get the CardConnect profileId
	var get_fv_url = properties.m3_xtend_table_uri +
		properties.m3_get_auth_value_uri;

	console.log((new Date()).toISOString() + ": getting card auth data from extension table: " + get_fv_url);
	var record = {
		cono : cono,
		divi : divi,
		ORNO : orno
	};
	await callM3API_V2(get_fv_url,record).then(async function(response) {
		authData.token = response["TOKN"]
		authData.accttype = response["ATYP"]
		authData.expiry = response["EXP0"]
		authData.authdate = response["AUTS"]
		authData.transaction_status = response["STAT"]
		authData.retref = response["REFN"]
		authData.amount = response["CCAA"]
		if (properties.look_for_profileid_at_orderlevel){
			authData.profileid = response["PFID"]
		}
		orderAlreadyHasCard = true;
		console.log((new Date()).toISOString() + ": orno:" + orno + " authData:" + JSON.stringify(authData, null, 2));
	}).catch(async function(error) {
		var error_msg = "There was an error trying to retrieve account data. The error message is: " + error;
		console.log((new Date()).toISOString() + ": AJAX error in request: " + error_msg);
		let searchStr = "No Record found"
		let checkSearchStr = error_msg.toLowerCase().includes(searchStr.toLowerCase())
		if(!checkSearchStr){
			displayError("On getCardAuthDataFromExtensionTables, fail:" + error_msg);
		}
		
	})
	cardAuthDict[orno] = authData;
	return authData;
}
async function getOrderHeadData() {
	if (!properties.useM3) return "1234.56";
	if (ordersDict[orno]) return ordersDict[orno];
	var order_data = {};
	var api_invocation_url = properties.m3_OIS100MI_uri +
		properties.m3_get_order_head;
	console.log((new Date()).toISOString() + ": api invocation url: " + api_invocation_url);
	var record = {
		cono : cono,
		divi : divi,
		ORNO : orno,
		CONO : cono
	};
	displayProcessState("Retrieving order data for ORNO " + orno);
	await callM3API_V2(api_invocation_url,record).then(async function(response) {
		ortp = response["ORTP"]
		tepy = response["TEPY"]
		orderAmount = response["TOPY"]
		cucd = response["CUCD"]
		
		order_data.orno = orno;
		order_data.ortp = ortp;
		order_data.tepy = tepy;
		order_data.orderAmount = orderAmount;
		order_data.cucd = cucd;
		ordersDict[orno] = order_data;
		console.log((new Date()).toISOString() + ": ORTP:" + ortp + " TEPY:" + tepy + " orderAmount:" + orderAmount + " CUCD:" + cucd);
	}).catch(async function(error) {
		console.log((new Date()).toISOString() + ": AJAX error in request: " + error);
		var error_msg = "There was an error trying to retrieve account data. The error message is: " + error;
		displayError("on getOrderHeadData, fail:" + error_msg);
	})
	return order_data;
}

function checkM3Api() {
	if (!properties.useM3) return;
	var api_invocation_url = properties.m3_CRS610MI_uri +
		properties.m3_fpwversion_uri;
	console.log((new Date()).toISOString() + ": api invocation url: " + api_invocation_url);

	var request_body = {}
	callM3API_V2(api_invocation_url,request_body).then(async function(response) {
		var s = "Success testing api; response says Version is: " + response.MIRecord["0"].NameValue["0"].Value;
		console.log((new Date()).toISOString() + ": " + s);
		showTestResults(s);
	}).catch(function (error) {
		console.log((new Date()).toISOString() + ": error in request: " + error);
		var error_msg = "There was an error trying to retrieve account data. The error message is: " + error;
		displayError("on checkM3Api, fail:" + error_msg);
	})
}

//*************************** Utility functions ****************************************
async function initializeApp() {
	hideLoading();
	// put the order number in the title
	$("#orno_wrapper").text("Order Number: " + orno);
	$("#cuno_wrapper").text("Customer Number: " + cuno);
	$("title").text("Credit Card Panel :: ORNO " + orno);

	// get properties for specific company
	var propertyDrivingParams = {};
	propertyDrivingParams.environment = environment;
	propertyDrivingParams.orderCountry = orderCountry;

	properties = getProperties(propertyDrivingParams);
	console.log((new Date()).toISOString() + ": environment: " + environment);
	console.log((new Date()).toISOString() + ": environment props:" + JSON.stringify(properties, null, 2));
	console.log((new Date()).toISOString() + ": cuno: " + cuno);
	console.log((new Date()).toISOString() + ": orno: " + orno);
	console.log((new Date()).toISOString() + ": divi: " + divi);
	console.log((new Date()).toISOString() + ": undeliveredGoodsValue: " + undeliveredGoodsValue);
	//console.log((new Date()).toISOString()+": cono: "+cono);
	console.log((new Date()).toISOString() + ": merchantId: " + properties.cardconnect_merchant_id);
	console.log((new Date()).toISOString() + ": order country: " + orderCountry);
	console.log((new Date()).toISOString() + ": currency: " + currency);

	// hide the "close" button if not in an H5 environment b/c our script can't
	// close the window (because a window can only be closed by the script that opened
	// it and our script doesn't open a window triggered by ISO)
	if (window.opener == null) hideCloseButton();
	// hide the display panels
	hideProcessState();
	// first - get values from the extension tables

	var inquiry_result = {};
	var authData = await getCardAuthDataFromExtensionTables();
	if (authData.retref) {
		// looks like we have a card associated with the order; we need to set global variables
		token = authData.token;
		associatedToken = token;
		accttype = authData.accttype;
		retref = authData.retref;
		expiry = authData.expiry;
		if (properties.look_for_profileid_at_orderlevel && authData.profileid) cardservices_profile_id = authData.profileid;
		inquiry_result = await inquire(authData.retref);
	}
	if (properties.persist_profile_id && "" === cardservices_profile_id)
		await getProfileIdFromExtensionTables(cuno);

	// get accounts if we have a cardservices_profile_id
	if ("" === cardservices_profile_id) {
		// we don't know the customer's CardConnect profileId
		if (authData.retref) {
			// variables and then display the card and options
			authData.name = "Unknown";
			accounts = [];
			accounts.push(authData);
			buildAccountsTables(accounts);
			$("#associated_card_table").show();
			$("#table_legend").hide();
		} else {
			displayNewCardElements();
		}
	} else {
		await getAccounts();
		if ("" === associatedToken) {
			$("#accounts_table").show();
			$("#table_legend").show();
		} else {
			$("#associated_card_table").show();
			$("#table_legend").hide();
			token = associatedToken;
		}
		if (canChangeCard) {
			$("#card_options_wrapper").show();
		}
		if (inquiry_result && inquiry_result.status) showCCOptions(inquiry_result.status);
		else showCCOptions("New Card");
		loadIframe();
	}
	displayCardOptions(canChangeCard);
	$('#close_button_wrapper').css("margin-top","15px")
	loadButtonActions();
}
function showLoading() {
	console.log("Nikhil inside showLoading");
	$('.loading').show();
}
function hideLoading(callback) {
	console.log("Nikhil inside hideLoading");
	$('.loading').hide();
	if (callback)
		callback();
}
function loadButtonActions() {
	// load the button_actions.js file. This way enables debugging, whereas 
	// loading via <script..../> tag doesn't (nor, even, do the jQuery references work)
	$.ajax({
		crossDomain: true,
		dataType: "script",
		url: "button_actions.js",
		cache: true,
		async: false,
		success: function () {
			console.log((new Date()).toISOString() + ": successfully loaded button_actions.js");
		},
		error: function () {
			console.log((new Date()).toISOString() + ": load of button_actions.js FAILED!!");
		}
	});
}

function buildAccountsTables(accts_array) {
	// build the table with all of the cards in case the user can change cards
	$("#accounts_table").find("tr").remove();
	$("#accounts_table").append(generateAccountsTableHeaderRow());
	// also build an associated card table for initial display
	$("#associated_card_table").find("tr").remove();
	$("#associated_card_table").append(generateAccountsTableHeaderRow());
	var tr;
	for (var i = 0; i < accts_array.length; i++) {
		var isDefaultCard = false;
		var isAssociatedCard = false;
		var decorator = "";
		var defaultIndicator = "";
		if ("Y" === accts_array[i].defaultacct) {
			isDefaultCard = true;
			prepopulateNewCardFields(accts_array[i]);
			defaultIndicator = "checked";
		}
		if (accts_array[i].token == associatedToken) { isAssociatedCard = true; }
		if (isAssociatedCard) { decorator = "class=\"associated_card\""; }
		else if (isDefaultCard) { decorator = "class=\"default\""; }
		tr = generateCardRowForTable(accts_array[i], isDefaultCard, decorator, canChangeCard);
		$("#accounts_table").append(tr);
		if (isAssociatedCard) {
			tr2 = generateCardRowForTable(accts_array[i], isDefaultCard, decorator, false);
			$("#associated_card_table").append(tr2);
		}
	}
}

function generateAccountsTableHeaderRow() {
	tr = $("<tr>");
	if (properties.persist_profile_id || properties.look_for_profileid_at_orderlevel) {
		tr.append("<th>&nbsp;</th><th>Name</th><th>Card Type</th><th>Last 4</th><th>Expiry</th></tr>");
	} else {
		tr.append("<th>&nbsp;</th><th>Last 4</th><th>Expiry</th></tr>");
	}
	return tr;
}

function generateCardRowForTable(json, isDefaultCard, decorator, allowCardChange) {
	tr = $("<tr id=\"tr_" + json.token + "\"/>");
	if (allowCardChange) tr.append("<td><input id=\"" + json.token + "\" type=\"radio\" name=\"selected_card\"/></td>");
	else tr.append("<td>&nbsp;</td>");
	if (properties.persist_profile_id || properties.look_for_profileid_at_orderlevel) {
		tr.append("<td " + decorator + ">" + json.name + "</td>");
		tr.append("<td id=\"acctType_" + json.token + "\"" + decorator + ">" + json.accttype + "</td>");
	}
	tr.append("<td id=\"last4_" + json.token + "\"" + decorator + ">" + json.token.substr(json.token.length - 4) + "</td>");
	tr.append("<td id=\"expiry_" + json.token + "\"" + decorator + ">" + json.expiry + "</td>");
	if (properties.allow_card_deletions && !isDefaultCard && allowCardChange && json.acctid) {
		tr.append("<td id=\"delToken_" + json.token + "\"><button id=\"delCard_" + json.acctid + "_" + json.token + "\" class=\"ccprocess-button\">Del</button><br></td>");
	}
	return tr;
}

function formatDate(d) {
	var year = d.getFullYear().toString();
	var month = (d.getMonth() + 1).toString();
	if (month.length == 1) month = "0" + month;
	var day = d.getDate().toString();
	if (day.length == 1) day = "0" + day;
	var hours = d.getHours().toString();
	if (hours.length == 1) hours = "0" + hours;
	var minutes = d.getMinutes().toString();
	if (minutes.length == 1) minutes = "0" + minutes;
	var seconds = d.getSeconds();
	if (seconds.length == 1) seconds = "0" + seconds;
	var formatted_date = year + "/" + month + "/" + day + " " + hours + ":" + minutes + ":" + seconds;
	return formatted_date;
}

function calculateAuthAmount() {
	// logic to calculate the amount that we need to authorize
	if (undeliveredGoodsValue === 0) {
		return 0;
	} else {
		return (undeliveredGoodsValue * 1);  // changes strings to numbers
	}
}

function ensureDecimal(authAmount) {
	// the value coming out of M3 is in Dollars (or other whole currency). CardConnect, though,
	// looks at numbers in two ways: if there is a decimal point, it respects that. But - if
	// there isn't a decimal point, it assumes the amount is in cents (or hundredths of the currency).
	// So - CardConnect would see $456 as $4.56. Let's make sure the value we pass to 
	// CardConnect has a decimal.
	var authAmountAsString = authAmount.toString();
	if (authAmountAsString.indexOf(".") == -1) {
		return authAmountAsString.concat(".");
	}
	return authAmountAsString;
}

function clearNewCardData() {
	$("#expiry").css("color", "#e0e0e0");
	$("#expiry").val("MMYY");
	$("#cardholder_name").val("");
	$("#cardholder_addy").val("");
	$("#cardholder_city").val("");
	$("#cardholder_region").val("");
	$("#cardholder_postal_code").val("");
	$("#cardholder_email").val("");
	$("#cardholder_phone").val("");
	$("#error_div_wrapper").fadeOut();
	$("#process_state_div_wrapper").fadeOut();
	$("#add_card_wrapper").fadeOut();
	$("#submit_card").switchClass("ccprocess-button", "ccprocess-logical-next");
	loadIframe();
}

function loadIframe() {
	console.log((new Date()).toISOString() + ": Loading iFrame");
	const tknURL = encodeURI(properties.cardconnect_host + ":" + properties.cardconnect_port + properties.tokenizer_uri);
	document.getElementById("tokenframe").src = tknURL;
}

function prepopulateNewCardFields(json) {
	// pre-populate customer info fields
	$("#cardholder_name").val(json.name);
	$("#cardholder_addy").val(json.address);
	$("#cardholder_city").val(json.city);
	$("#cardholder_region").val(json.region);
	$("#cardholder_country").val(json.country);
	$("#cardholder_postal_code").val(json.postal);
	$("#cardholder_phone").val(json.phone);
	$("#cardholder_email").val(json.email);
}

function displayError(error_msg) {
	if (error_msg === "Invalid Account Number") error_msg = "Invalid Card Number"; // rewording error coming back from CardConnect
	$("#error_div").text(error_msg);
	if (!$("#error_div_wrapper").is(":visible")) $("#error_div_wrapper").fadeIn();
}

function hideErrorDisplay() {
	if ($("#error_div_wrapper").is(":visible")) $("#error_div_wrapper").fadeOut();
}

function displayProcessState(state) {
	$("#process_state_div").text(state);
	if (!$("#process_state_div_wrapper").is(":visible")) $("#process_state_div_wrapper").fadeIn();
}

function hideProcessState() {
	if ($("#process_state_div_wrapper").is(":visible")) $("#process_state_div_wrapper").fadeOut();
}

function showRefundOption() {
	if (properties.allow_card_refund) {
		$("#refund_button_wrapper").show();
		$("#refund_option").show();
		$("input[id='refund']").prop("checked", false);
	}
}
function showCaptureOption() {
	if (properties.allow_capture) {
		$("#capture_button_wrapper").show();
		$("#capture_option").show();
		$("input[id='capture']").prop("checked", false);
	}
}
function showAuth0Option() {
	if (properties.allow_zero_auth) {
		$("input[id='authW0']").prop("checked", false);
		$("#auth0_option").show();
	}
}
function showAuthActualOption() {
	if (properties.allow_actualamt_auth) {
		$("input[id='authWActual']").prop("checked", false);
		$("#authActual_option").show();
	}
}
function showAuthOptions() {
	showAuth0Option();
	showAuthActualOption();
}
function showVoidOption() {
	if (properties.allow_void) {
		$("#void_button_wrapper").show();
		$("#void_option").show();
		$("input[id='void']").prop("checked", false);

	}
}
function hideAuthOptions() {
	hideAuth0Option();
	hideAuthActualOption();
}
function hideAuth0Option() {
	$("#auth0_option").hide();
}
function hideAuthActualOption() {
	$("#authActual_option").hide();
}
function hideCaptureOption() {
	$("#capture_button_wrapper").hide();
	$("#capture_option").hide();
	$("#capture").prop('checked', false);
}
function hideRefundOption() {
	$("#refund_button_wrapper").hide();
	$("#refund_option").hide();
	$("#refund").prop('checked', false);
}
function hideVoidOption() {
	$("#void_button_wrapper").hide();
	$("#void_option").hide();
	$("#void").prop('checked', false);
}
function hideUseCardOption() {
	$("#use_card_button_wrapper").hide();
}
function hideCCActionsButton() {
	$("#cc_actions_button_wrapper").hide();
}
function showCCOptions(transaction_status) {
	//start by hiding everything
	hideUseCardOption();
	hideCaptureOption();
	hideAuth0Option();
	hideAuthActualOption();
	hideRefundOption();
	hideVoidOption();
	hideCCActionsButton();

	if (transaction_status === "Authorized") {
		// Txn is authorized but has not been Captured, so show the "Capture" option
		showCaptureOption();
		showVoidOption();

	} else if (transaction_status === "Accepted" ||
		transaction_status === "Queued for Capture" ||
		transaction_status === "Captured") {
		// Txn has been captured - can only refund now
		showRefundOption();

	} else if (!transaction_status || transaction_status === "New Card" ||
		transaction_status === "Change Card") {
		showAuthOptions();

	} else if (transaction_status === "Zero Amount") {
		showAuthActualOption();

	} else if (transaction_status === "Refunded" ||
		transaction_status === "Voided") {
		showAuthOptions();
	}
	$('#close_button_wrapper').css("margin-top","15px")
}

function displayExistingCardElements() {
	$("#accounts_display").show();
	$("#accounts_table").show();
	$("#associated_card_table").hide();
	$("#new_card_data").hide();
	$("#table_legend").show();
	displayCardOptions(canChangeCard);
	$("#existing_cards_button").hide();
	showCCOptions("Change Card");
}

function displayAssociatedCardElements() {
	$("#accounts_display").show();
	$("#accounts_table").hide();
	$("#associated_card_table").show();
	$("#new_card_data").hide();
	$("#table_legend").hide();
	displayCardOptions(canChangeCard);
}

function displayNewCardElements() {
	loadIframe();
	$("#accounts_display").hide();
	$("#new_card_data").show();
	displayCardOptions(canChangeCard);
	$("#new_card_button").hide();
}

function showTestResults(content) {
	$("#test_results_display").text(content);
	if (!$("#test_results_display").is(":visible")) $("#test_results_display").fadeIn();
}

function buildNameValuePair(nv, name, value) {
	nv.name = name;
	nv.value = value;
}

function confirmAction(dialogText, action, cancelAction, dialogTitle) {
	$('<div style="padding: 10px; max-width: 500px; word-wrap: break-word;">' + dialogText + '</div>').dialog({
		draggable: false,
		modal: true,
		resizable: false,
		width: 'auto',
		title: dialogTitle || 'Confirm',
		minHeight: 75,
		buttons: {
			OK: function () {
				if ("refund" === action) {
					refundCardProcess();
				} else if ("capture" === action) {
					captureCardProcess();
				} else if ("authW0" === action) {
					updateOrderCardProcess(0);
				} else if ("authWActual" === action) {
					updateOrderCardProcess(null);
				} else if ("void" === action) {
					voidTransactionProcess(null);
				}
				$(this).dialog('destroy');
			},
			Cancel: function () {
				if ("hide_cc_actions_button" === cancelAction) {
					hideCCActionsButton();
				}
				$(this).dialog('destroy');
			}
		}
	});
}

function hideCCActionsButton() {
	$("#cc_actions_button_wrapper").hide();
	$("[name^='cc_action']").prop('checked', false);
}
function validateAddress(address) {
	var v_results = {};
	if (address && "" != address) {
		v_results.isValid = true;
	} else {
		v_results.isValid = false;
		v_results.message = "You must provide an address.";
	}
	return v_results;
}
function validateCity(city) {
	var v_results = {};
	if (city && "" != city) {
		v_results.isValid = true;
	} else {
		v_results.isValid = false;
		v_results.message = "You must provide a city.";
	}
	return v_results;
}

function validateState(state) {
	var v_results = {};
	if (state && "" != state) {
		v_results.isValid = true;
	} else {
		v_results.isValid = false;
		v_results.message = "You must provide a state.";
	}
	return v_results;
}
function validatePostalCode(postalCode) {
	var v_results = {};
	if (postalCode && "" != postalCode) {
		v_results.isValid = true;
	} else {
		v_results.isValid = false;
		v_results.message = "You must provide a postal code.";
	}
	return v_results;
}
function validatePhoneNumber(phoneNumber) {
	var v_results = {};
	if (phoneNumber && "" != phoneNumber) {
		v_results.isValid = true;
	} else {
		v_results.isValid = false;
		v_results.message = "You must provide a phone number.";
	}
	return v_results;
}
function validateEmail(email) {
	var v_results = {};
	if (email && "" != email && email.indexOf("@") != -1) {
		v_results.isValid = true;
	} else {
		v_results.isValid = false;
		v_results.message = "You must provide a properly-formatted email address.";
	}
	return v_results;
}

function hideCloseButton() {
	$("#close_button_wrapper").hide();
}

//M3 API Functions
var callM3API = (api, query = {}) => {
	return new Promise(async (resolve, reject) => {
		try {
			let queryString = '?'
			Object.keys(query).map(k => queryString += (k + '=' + query[k] + '&'))
			var csrfToken = await getValidToken()
			$.ajax({
				type: "GET",
				url: "/m3api-rest/execute/" + api + ';metadata=true;maxrecs=0;excludempty=false' + queryString,
				dataType: "json",
				headers: { 'fnd-csrf-token': csrfToken },
				success: function (response) {
					if (response['MIRecord'] != undefined) {
						let returnValue = []
						response['MIRecord'].map(MiRec => {
							if (MiRec.NameValue != undefined) {
								let row = {}
								MiRec.NameValue.map(k => row[k.Name] = k.Value.trim())
								returnValue.push(row)
							}
						})
						resolve(api.includes('Lst') ? returnValue : returnValue[0])
					} else {
						reject(response.Message.replace(/ +/g, ' '))
					}
				}
			})
		} catch (error) {
			reject('Error calling ' + api + ' API')
		}
	})
}
var callM3API_V2 = (api, query = {}) => {
	return new Promise(async (resolve, reject) => {
		try {
			let queryString = '?'
			Object.keys(query).map(k => queryString += (k + '=' + query[k] + '&'))
			var csrfToken = await getValidToken()
			$.ajax({
				type: "GET",
				url: "/m3api-rest/v2/execute/" + api + ';metadata=true;maxrecs=0;excludempty=false' + queryString,
				dataType: "json",
				headers: { 'fnd-csrf-token': csrfToken },
				success: function (response) {
					if (response["nrOfFailedTransactions"] > 0) {
						reject(response['results'][0]['errorMessage'].replace(/ +/g, ' '))
					} else {
						resolve(response['results'][0]['records'][0])
					}
				}
			})
		} catch (error) {
			reject('Error calling ' + api + ' API' + "error:" + error)
		}
	})
}
//IONAPIService Class definition
var IonApiService = (function () {
	class a {
		constructor() { }
		getBaseUrl() {
			if (!this.baseUrl) {
				//   var b = window.opener.ScriptUtil.GetUserContext()
				this.IonApiUrl = localStorage.getItem("IonApiUrl")
				this.Tenant = localStorage.getItem("Tenant")
				this.baseUrl = ""
				if (this.IonApiUrl && this.Tenant) {
					this.baseUrl = this.joinWithSlash(this.IonApiUrl, this.Tenant)
				}
			}
			return this.baseUrl
		}
		getToken(d) {
			var f = this
			if (d === void 0) {
				d = false
			}
			var b = d
			if (!this.token) {
				b = true
			}
			return new Promise(function (h, g) {
				if (!b) {
					h(f.token)
				} else {
					f.refreshToken().then(function (k) {
						h(k)
					}, function (k) {
						g(k)
					})
				}
			})
		}
		setToken(b) {
			this.token = b
		}
		execute(b) {
			var d = this
			return new Promise(function (g, f) {
				if (!b) {
					f()
				}
				b.url = d.buildUrl(b)
				d.getToken().then(function (h) {
					d.callApi(b, h).then(function (k) {
						g(k)
					}, function (k) {
						f(k)
					})
				}, function (h) {
					f(h)
				})
			})
		}
		buildUrl(d) {
			var b = ""
			if (d && d.url) {
				b = d.url
			}
			if (d.url.indexOf("http") !== 0) {
				b = this.joinWithSlash(this.getBaseUrl(), b)
			}
			if (d.record) {
				var h = ""
				for (var g in d.record) {
					if (d.record.hasOwnProperty(g)) {
						var f = d.record[g]
						if (f != null) {
							h = "" + h + g + "=" + encodeURIComponent(f) + "&"
						}
					}
				}
				h = h.substring(0, h.length - 1)
				if (this.hasParams(b)) {
					b = b + "&" + h
				} else {
					b = b + "?" + h
				}
			}
			return b
		}
		callApi(f, d, b) {
			var g = this
			if (b === void 0) {
				b = false
			}
			return new Promise(function (l, k) {
				var h = {
					url: f.url,
					contentType: f.contentType || "application/json",
					dataType: f.responseType || "JSON",
					cache: f.cache || false,
					type: f.method || "GET",
					beforeSend: function (n) {
						n.setRequestHeader("Authorization", "Bearer " + d)
						var m = g.getAcceptHeader(f.responseType)
						n.setRequestHeader("Accept", m)
						if (f.headers) {
							for (var o in f.headers) {
								n.setRequestHeader(o, f.headers[o])
							}
						}
					}
				}
				if (f.data) {
					h.data = f.data
				}
				$.ajax(h).then(function (m, p, o) {
					var n = {
						data: m,
						status: o ? o.status : 200,
						statusText: o ? o.statusText : p
					}
					l(n)
				}, function (n, p, o) {
					if (n.status === 401 && !b) {
						g.getToken(true).then(function (q) {
							g.callApi(f, q, true).then(function (r) {
								l(r)
							}, function (r) {
								k(r)
							})
						})
					} else {
						var m = {
							data: n.responseJSON,
							status: n.status,
							statusText: p,
							message: o
						}
						k(m)
					}
				})
			})
		}
		refreshToken() {
			var d = this
			var b = "/grid/rest/security/sessions/oauth?forceRefresh=true"
			return new Promise(function (h, g) {
				var f = {
					url: b,
					cache: false,
					type: "GET"
				}
				$.ajax(f).then(function (k, n, m) {
					if (d.isValidToken(k)) {
						d.token = k
						h(k)
					} else {
						var l = {
							statusText: "error",
							message: "Unable to retrieve token"
						}
						g(l)
					}
				}, function (l, n, m) {
					var k = {
						status: l.status,
						statusText: n,
						message: m
					}
					g(k)
				})
			})
		}
		getAcceptHeader(b) {
			if (!b) {
				b = "JSON"
			}
			switch (b.toUpperCase()) {
				case "JSON":
					return "application/json"
				case "TEXT":
					return "text/xml"
				case "XML":
					return "application/xml"
				default:
					return b
			}
		}
		joinWithSlash(f, b) {
			var d = 0
			if (!f) {
				return b
			}
			if (!b) {
				return f
			}
			if (f.lastIndexOf("/") === f.length - 1) {
				d++
			}
			if (b.indexOf("/") === 0) {
				d++
			}
			switch (d) {
				case 2:
					return f + "/" + b.substring(1)
				case 1:
					return "" + f + b
				case 0:
				default:
					return f + "/" + b
			}
		}
		isValidToken(b) {
			if (b) {
				return b.indexOf("<html>") < 0
			}
			return false
		}
		hasParams(b) {
			if (!b) {
				return false
			}
			var d = b.split("?")
			return d.length > 1
		}
	}
	a.Current = new a()
	return a
}())