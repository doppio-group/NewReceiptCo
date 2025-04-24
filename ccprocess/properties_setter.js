	/*************************************************
	*  button_actions.js
*  script for setting implementation-specific properties
*  12/12/17
*
*************************************************/

function showVersion(){
	var script_name = "properties_setter.js";
	var script_version = "1.0.0";
	console.log("script:"+script_name+" version:"+script_version);
}
showVersion();
	
//  *****************  ENVIRONMENT-SPECIFIC PROPERTIES  *****************************
var test_properties = {}
test_properties.cardconnect_host = "https://iconex.cardconnect.com";
test_properties.cardconnect_port = "6443";
test_properties.webservices_host = "https://ccprocess-test.iconexstore.com";
test_properties.webservices_port = "2727";
test_properties.cardconnect_merchant_id_us = "496235175882";
test_properties.cardconnect_merchant_id_us2 = "496094002888";
test_properties.cardconnect_merchant_id_ca2 = "29201380011";
test_properties.cardconnect_merchant_id_ca = "311203256889";
test_properties.cardconnect_merchant_id_gb = "311203257887";
test_properties.cardconnect_merchant_id_fr = "311203258885";
test_properties.cardconnect_merchant_id_it = "311203259883";
test_properties.cardconnect_merchant_id_de = "311203260881";
test_properties.cardconnect_merchant_id_es = "311203261889";

var prod_properties = {}
prod_properties.cardconnect_host = "https://iconex.cardconnect.com";
prod_properties.cardconnect_port = "8443";
prod_properties.webservices_host = "https://ccprocess.iconexstore.com";
prod_properties.webservices_port = "2727";
prod_properties.cardconnect_merchant_id_us = "496235175882";
// prod_properties.cardconnect_merchant_id_us2 = "496094002888";
// prod_properties.cardconnect_merchant_id_ca2 = "29201380011";
prod_properties.cardconnect_merchant_id_ca = "311203256889";
// prod_properties.cardconnect_merchant_id_gb = "311203257887";
// prod_properties.cardconnect_merchant_id_fr = "311203258885";
// prod_properties.cardconnect_merchant_id_it = "311203259883";
// prod_properties.cardconnect_merchant_id_de = "311203260881";
// prod_properties.cardconnect_merchant_id_es = "311203261889";

var nikhil_properties = {}
nikhil_properties.cardconnect_host = "https://iconex.cardconnect.com";
nikhil_properties.cardconnect_port = "6443";
nikhil_properties.webservices_host = "https://localhost";
nikhil_properties.webservices_port = "8443";
nikhil_properties.cardconnect_merchant_id_us = "496235175882";
// nikhil_properties.cardconnect_merchant_id_us2 = "496094002888";
// nikhil_properties.cardconnect_merchant_id_ca2 = "29201380011";
nikhil_properties.cardconnect_merchant_id_ca = "311203256889";
// nikhil_properties.cardconnect_merchant_id_gb = "311203257887";
// nikhil_properties.cardconnect_merchant_id_fr = "311203258885";
// nikhil_properties.cardconnect_merchant_id_it = "311203259883";
// nikhil_properties.cardconnect_merchant_id_de = "311203260881";
// nikhil_properties.cardconnect_merchant_id_es = "311203261889";

//  *****************  PROPERTIES COMMON TO ALL ENVIRONMENTS  *****************************
// CardConnect uris
var common_properties  =  {}
common_properties.tokenizer_uri = "/itoke/ajax-tokenizer.html?css=.error{color:red;border-color:red;}&invalidinputevent=true";
common_properties.cardservices_getprofile_uri = "/CustomerApi/cc/ccapis/profile";
common_properties.cardservices_createprofile_uri = "/CustomerApi/cc/ccapis/profile";
common_properties.cardservices_updateprofile_uri = "/CustomerApi/cc/ccapis/profile";
common_properties.cardservices_auth_uri = "/CustomerApi/cc/ccapis/auth";
common_properties.cardservices_refund_uri = "/CustomerApi/cc/ccapis/refund";
common_properties.cardservices_capture_uri = "/CustomerApi/cc/ccapis/capture";
common_properties.cardservices_void_uri = "/CustomerApi/cc/ccapis/void";
common_properties.cardservices_inquire_uri = "/CustomerApi/cc/ccapis/inquire";
common_properties.m3_m3api_uri = "/m3api-rest/execute";
common_properties.m3_fpwversion_uri = "/FpwVersion";
common_properties.m3_CRS610MI_uri = "CRS610MI";
common_properties.m3_OIS100MI_uri = "OIS100MI";
common_properties.m3_extension_table_uri = "CUSEXTMI";
common_properties.m3_xtend_table_uri = "EXT002MI";
common_properties.m3_add_auth_value_uri = "/AddCCAuthInfo";
common_properties.m3_get_auth_value_uri = "/GetCCAuthInfo";
common_properties.m3_change_auth_value_uri = "/UpdCCAuthInfo";
common_properties.m3_get_field_value_uri = "/GetFieldValue";
common_properties.m3_add_field_value_uri = "/AddFieldValue";
common_properties.m3_delete_field_value_uri = "/DelFieldValue";
common_properties.m3_change_field_value_uri = "/ChgFieldValue";
common_properties.m3_get_order_head = "/GetHead";
common_properties.m3_card_connect_profile_id_field_name = "A430";
common_properties.m3_token_field_name = "A030";
common_properties.m3_expiry_field_name = "A130";
common_properties.m3_retref_field_name = "A230";
common_properties.m3_auth_date_field_name = "A330";
common_properties.m3_auth_code_field_name = "A530";
common_properties.m3_card_transaction_status_field_name = "A630";
common_properties.m3_order_profileid_field_name = "A830";
common_properties.m3_card_amount_field_name = "N096";

//  *****************  LOGICAL PROPERTIES     *****************************
common_properties.require_address=false
common_properties.require_phone=false
common_properties.require_email=false
common_properties.allow_card_deletions=false
common_properties.allow_card_refund=false
common_properties.allow_zero_auth=true
common_properties.allow_actualamt_auth=false
common_properties.allow_capture=false
common_properties.allow_void=false
common_properties.persist_profile_id=false
common_properties.look_for_profileid_at_orderlevel=false

//  *****************  DEV-STAGE PROPERTIES     *****************************
common_properties.allow_window_close=true
common_properties.useM3=true

function getProperties(params) {
  /*
  This script file is used to get the properties needed for
  CardConnect and m3 interaction for a specific company. It
  is intended that all customization for a given company take
  place in this file and in the properties.js file.
  */
  var properties = {};
  var selected_merchant_id = "";
  
  var environment = params.environment;
  var country = params.orderCountry;
  
  
if ("TEST" === environment || "TST" === environment) {
	if("US" === country) {
      selected_merchant_id = test_properties.cardconnect_merchant_id_us;
    } else if ("CA" === country) {
      selected_merchant_id = test_properties.cardconnect_merchant_id_ca;
    } else if ("GB" === country) {
      selected_merchant_id = test_properties.cardconnect_merchant_id_gb;
    } else if ("FR" === country) {
      selected_merchant_id = test_properties.cardconnect_merchant_id_fr;
    } else if ("IT" === country) {
      selected_merchant_id = test_properties.cardconnect_merchant_id_it;
    } else if ("DE" === country) {
      selected_merchant_id = test_properties.cardconnect_merchant_id_de;
    } else if ("ES" === country) {
      selected_merchant_id = test_properties.cardconnect_merchant_id_es;
    }else if ("US2" === country) {
      selected_merchant_id = test_properties.cardconnect_merchant_id_us2;
    }else if ("CA2" === country) {
      selected_merchant_id = test_properties.cardconnect_merchant_id_ca2;
    }
    // add more countries here
    properties = test_properties;
} else if ("PROD" === environment || "PRD" === environment) {
	  if("US" === country) {
      selected_merchant_id = prod_properties.cardconnect_merchant_id_us;
    } else if ("CA" === country) {
      selected_merchant_id = prod_properties.cardconnect_merchant_id_ca;
    } else if ("GB" === country) {
      console.log("Nikhil in GB true");
      selected_merchant_id = prod_properties.cardconnect_merchant_id_gb;
    } else if ("FR" === country) {
      selected_merchant_id = prod_properties.cardconnect_merchant_id_fr;
    } else if ("IT" === country) {
      selected_merchant_id = prod_properties.cardconnect_merchant_id_it;
    } else if ("DE" === country) {
      selected_merchant_id = prod_properties.cardconnect_merchant_id_de;
    } else if ("ES" === country) {
      selected_merchant_id = prod_properties.cardconnect_merchant_id_es;
    }else if ("US2" === country) {
      selected_merchant_id = test_properties.cardconnect_merchant_id_us2;
    }else if ("CA2" === country) {
      selected_merchant_id = test_properties.cardconnect_merchant_id_ca2;
    }
    properties = prod_properties;

}
else if ("NIKHIL" === environment || "nikhil" === environment) {
	if("US" === country) {
      selected_merchant_id = nikhil_properties.cardconnect_merchant_id_us;
    } else if ("CA" === country) {
      selected_merchant_id = nikhil_properties.cardconnect_merchant_id_ca;
    } else if ("GB" === country) {
      selected_merchant_id = nikhil_properties.cardconnect_merchant_id_gb;
    } else if ("FR" === country) {
      selected_merchant_id = nikhil_properties.cardconnect_merchant_id_fr;
    } else if ("IT" === country) {
      selected_merchant_id = nikhil_properties.cardconnect_merchant_id_it;
    } else if ("DE" === country) {
      selected_merchant_id = nikhil_properties.cardconnect_merchant_id_de;
    } else if ("ES" === country) {
      selected_merchant_id = nikhil_properties.cardconnect_merchant_id_es;
    }else if ("US2" === country) {
      selected_merchant_id = test_properties.cardconnect_merchant_id_us2;
    }else if ("CA2" === country) {
      selected_merchant_id = test_properties.cardconnect_merchant_id_ca2;
    }
    // add more countries here
    properties = nikhil_properties;
}
  
  delete properties.cardconnect_merchant_id_us;
  delete properties.cardconnect_merchant_id_ca;
  // REMEMBER!!!! clean up country-specific merchantIds here to avoid confusion
  properties.cardconnect_merchant_id = selected_merchant_id;
  console.log("MerchantId Selected:"+selected_merchant_id);
   for(key in common_properties)
     properties[key]=common_properties[key];

  return properties;
}