// Milk the Cow
// - Dashboard Widget for Remember the Milk
// - Author: Rich Hong (hong.rich@gmail.com)
// - http://code.google.com/p/milkthecow/
//
//This product uses the Remember The Milk API but is not endorsed or certified by Remember The Milk.

var api_key = "127d19adab1a7b6922d8dfda3ef09645";
var shared_secret = "503816890a685753";
var debug = false;

var methurl = "http://api.rememberthemilk.com/services/rest/";
var authurl = "http://www.rememberthemilk.com/services/auth/";

var frob;
var toekn;
var timeline;
var user_id;
var user_username;
var user_fullname;

var tasks = [];
var lastTrans = null;
var detailsOpen = false;
var selectedList = ""; //selected list
var currentTask = null; //the task with details box showing
var editing = false; //currently editing a field

var gMyScrollArea, gMyScrollbar;

// JavaScript interval timer to refresh
var updateRefreshInterval;

//
// Function: load()
// Called by HTML body element's onload event when the widget is ready to start
//
function load()
{
	$.ajaxSetup({
		async:false,
		type:"GET",
		beforeSend: function (req) { req.setRequestHeader("Cache-Control", "no-cache"); }
	});
	$("#loading").ajaxStart(function(){
		$(this).show();
	});
	$("#loading").ajaxStop(function(){
		//$(this).hide();
		$(this).fadeOut("slow");
	});
    
	//setup Apple buttons
	new AppleGlassButton(document.getElementById("done"), "Done", showFront);
	new AppleInfoButton(document.getElementById("info"), document.getElementById("front"), "white", "black", showBack);
	new AppleButton(document.getElementById("tasks_button"),"Refresh",20,"Images/button_left.png","Images/button_left_clicked.png",5,"Images/button_middle.png","Images/button_middle_clicked.png","Images/button_right.png","Images/button_right_clicked.png",5,refresh);
		
	//setup Apple Scrollbar
	gMyScrollbar = new AppleVerticalScrollbar(document.getElementById("listScrollbar"));
	gMyScrollArea = new AppleScrollArea(document.getElementById("listDiv"),gMyScrollbar);

	refresh();

	//startRefreshTimer();
}

function startRefreshTimer()
{
	refresh();
	if (!updateRefreshInterval)
		updateRefreshInterval = setInterval(refresh, 1000);
}

function stopRefreshTimer()
{
	if (updateRefreshInterval) {
		clearInterval(updateRefreshInterval);
		updateRefreshInterval = null;
	}
}

//
// Function: remove()
// Called when the widget has been removed from the Dashboard
//
function remove()
{
	//stopRefreshTimer();
	widget.setPreferenceForKey(null, "token");
	widget.setPreferenceForKey(null, "timeline");
}

//
// Function: hide()
// Called when the widget has been hidden
//
function hide()
{
	//stopRefreshTimer();
}

//
// Function: show()
// Called when the widget has been shown
//
function show()
{
	//startRefreshTimer();
	refresh();
}

//
// Function: sync()
// Called when the widget has been synchronized with .Mac
//
function sync()
{
	token = widget.preferenceForKey("token");
	timeline = widget.preferenceForKey("timeline");
}

//
// Function: showBack(event)
// Called when the info button is clicked to show the back of the widget
//
// event: onClick event from the info button
//
function showBack(event)
{
	if (window.widget) widget.prepareForTransition("ToBack");
	document.getElementById("front").style.display = "none";
	document.getElementById("back").style.display = "block";
	if (window.widget) setTimeout('widget.performTransition();', 0);
	getLists();
}

//
// Function: showFront(event)
// Called when the done button is clicked from the back of the widget
//
// event: onClick event from the done button
//
function showFront(event)
{
	if (window.widget) widget.prepareForTransition("ToFront");
	document.getElementById("front").style.display="block";
	document.getElementById("back").style.display="none";
	if (window.widget) setTimeout('widget.performTransition();', 0);
	refresh();
}

if (window.widget) {
	widget.onremove = remove;
	widget.onhide = hide;
	widget.onshow = show;
	widget.onsync = sync;
}

//make rtm requests, return a json object
function rtmCall (data) {
	if(typeof(data) != "object") return "Need a data object";
	if(typeof(data.method) == "undefined") return "Need a method name";

	data.api_key = api_key;
	data.format = "json";
	if (typeof(token) != "undefined") data.auth_token = token;
	if (typeof(timeline) != "undefined") data.timeline = timeline;
	rtmSign(data);

	var json = eval("("+$.ajax({url: methurl,data: data}).responseText+")");
	return json;
}

//sign rtm requests
function rtmSign (args) {
	var arr = [];
	var str = shared_secret;

	for (var e in args) arr.push(e);
	arr.sort();

	for (var i=0;i<arr.length;i++) str+=arr[i]+args[arr[i]];
	var sig = String(hex_md5(str));
	//log("signstr: "+str);
	//log("signsig: "+sig);
	args.api_sig = sig;
}

//get frob (required for auth)
function rtmGetFrob () {
	var res = rtmCall({method:"rtm.auth.getFrob"});
	//log("frob: "+res.rsp.frob);
	if(res.rsp.stat == "ok") return res.rsp.frob;
	return "fail"; //fail to get frob
}

//create auth url
function rtmAuthURL (perms) {
	var url = authurl+"?";
	frob = rtmGetFrob();
	var data = {api_key:api_key,perms:perms,frob:frob};
	rtmSign(data);
	for (var a in data) url+= a + "=" + data[a] +"&";
	return url;
}

//add task to rtm
function rtmAdd (name){
	var res = rtmCall({method:"rtm.tasks.add",name:name,parse:"1"}).rsp;
	if (res.stat=="ok"&&res.transaction.undoable==1) lastTrans = res.transaction.id;
	refresh();
	return res.stat=="ok"?true:false;
}

//complete tasks[t]
function rtmComplete (t){
	var res = rtmCall({method:"rtm.tasks.complete",list_id:tasks[t].list_id,taskseries_id:tasks[t].id,task_id:tasks[t].task.id}).rsp;
	if (res.stat=="ok"&&res.transaction.undoable==1) lastTrans = res.transaction.id;
	refresh();
	return res.stat=="ok"?true:false;
}

//delete tasks[t]
function rtmDelete (t){
	var res = rtmCall({method:"rtm.tasks.delete",list_id:tasks[t].list_id,taskseries_id:tasks[t].id,task_id:tasks[t].task.id}).rsp;
	if (res.stat=="ok"&&res.transaction.undoable==1) lastTrans = res.transaction.id;
	refresh();
	return res.stat=="ok"?true:false;
}

//rename tasks[t]
function rtmName (t,name){
	var res = rtmCall({method:"rtm.tasks.setName",list_id:tasks[t].list_id,taskseries_id:tasks[t].id,task_id:tasks[t].task.id,name:name}).rsp;
	if (res.stat=="ok"&&res.transaction.undoable==1) lastTrans = res.transaction.id;
	refresh();
	return res.stat=="ok"?true:false;
}

//set due date for tasks[t]
function rtmDate (t,date){
	var res = rtmCall({method:"rtm.tasks.setDueDate",list_id:tasks[t].list_id,taskseries_id:tasks[t].id,task_id:tasks[t].task.id,due:date,parse:"1"}).rsp;
	if (res.stat=="ok"&&res.transaction.undoable==1) lastTrans = res.transaction.id;
	refresh();
	return res.stat=="ok"?true:false;
}

//undo last action
function rtmUndo (){
	var res = rtmCall({method:"rtm.transactions.undo",transaction_id:lastTrans}).rsp;
	lastTrans = null;
	refresh();
	return res.stat=="ok"?true:false;
}

//get token, then create timeline
function getAuthToken (){
	var auth = rtmCall({method:"rtm.auth.getToken",frob:frob}).rsp;
	if (auth.stat!="ok") return false;
	auth = auth.auth;
	token = auth.token;
	user_id = auth.user.id;
	user_username = auth.user.username;
	user_fullname = auth.user.fullname;
	if (window.widget) widget.setPreferenceForKey(token, "token");
	log("token: "+token);
	log("user_id: "+user_id);
	log("user_username: "+user_username);
	log("user_fullname: "+user_fullname);
	return createTimeline();
}

//check if the current token is valid
function checkToken (){
	if (window.widget){
		if (typeof(widget.preferenceForKey("token"))=="undefined") return getAuthToken();
		token = widget.preferenceForKey("token");
		timeline = widget.preferenceForKey("timeline");
	}
	var auth = rtmCall({method:"rtm.auth.checkToken"}).rsp;
	if (auth.stat=="ok") return true;
	return getAuthToken();
}

//create timeline (required to undo action)
function createTimeline (){
	var res = rtmCall({method:"rtm.timelines.create"}).rsp;
	if (res.stat!="ok") return false;
	timeline = res.timeline;
	if (window.widget) widget.setPreferenceForKey(timeline, "timeline");
	log("timeline: "+timeline);
	return true;
}

//get list of lists
function getLists (){
	var lists = rtmCall({method:"rtm.lists.getList"}).rsp.lists.list;
	$("#magiclist").empty();
	$("#magiclist").append("<option value=''>All</option>");
	$("#magiclist").append("<option disabled>---</option>");
	for (var l in lists){
		if (("list:\""+lists[l].name+"\"")==selectedList) $("#magiclist").append("<option selected value='list:\""+lists[l].name+"\"'>"+lists[l].name+"</option>");
		else $("#magiclist").append("<option value='list:\""+lists[l].name+"\"'>"+lists[l].name+"</option>");
	}
}

//called when magic filter is changed
function filterChange (){
	var s = "";
	var first = true;
	var values = ['magiclist','magicpriority','magicstatus'];
	for (var v in values){
		if (document.getElementById(values[v]).value!=""){
			if (first) first = false;
			else s += " AND ";
			s += document.getElementById(values[v]).value;
		}
	}
	if (document.getElementById('magictext').value!=""){
		if (first) first = false;
		else s += " AND ";
		s += "name:\""+document.getElementById('magictext').value+"\"";
	}
	if (document.getElementById('magictags').value!=""){
		if (first) first = false;
		else s += " AND ";
		s += "tag:"+document.getElementById('magictags').value;
	}
	document.getElementById('customtext').value = s;
	selectedList = document.getElementById('magiclist').value;
}

//show details of tasks[t]
function showDetails (t){
	currentTask = t;
	if (!detailsOpen){
		detailsOpen = true;
		if (window.widget) window.resizeTo(480,380);
		$("#taskDetails").css("border-style","solid");
		$("#taskDetails").animate({width: "200px"},1000,showDetails(t));
		return;
	}
	editing=false;
	$("#detailsName").html(tasks[t].name);
	sdate="";
	if (tasks[t].date.getTime()==2147483647000)
		sdate="never"; //no due date
	else
		sdate=tasks[t].date.format("d mmm yy");
	if (tasks[t].task.has_due_time==1)
		sdate += " at "+ tasks[t].date.format("h:MM TT");
	$("#detailsdue_span").html(sdate);
	$("#detailsDiv").css("display","block");
}

//close detail box
function closeDetails (){
	currentTask = null;
	if (detailsOpen){
		detailsOpen = false;
		$("#taskDetails").animate({width: "0px"},1000,closeDetails);
		$("#detailsDiv").css("display","none");
		return;
	}
	if (window.widget) window.resizeTo(280,380);
	$("#taskDetails").css("border-style","none");
}

//edit the date field in details
function editDate (){
	if (editing) return;
	editing=true;
	$("#detailsdue_span").css("display","none");
	$("#detailsdue_editfield").css("display","block");
	$("#detailsdue_editfield").val($("#detailsdue_span").html());
	$("#detailsdue_editfield").focus();
}

//finish editing date
function dateEdit (){
	$("#detailsdue_span").css("display","inline");
	$("#detailsdue_editfield").css("display","none");
	var old = $("#detailsdue_span").html();
	var cur = $("#detailsdue_editfield").val();
	if (old!=cur) rtmDate(currentTask,cur);
	showDetails(currentTask);
}

//keypress listener for editing due date
function dateKeyPress (event){
	switch (event.keyCode)
	{
		case 13: // return
		case 3:  // enter
			dateEdit();
			break;
	}
}

//edit the name field in details
function editName (){
	$("#detailsName").css("display","none");
	$("#detailsName_edit").css("display","block");
	$("#detailsName_edit").val($(detailsName).html());
	$("#detailsName_edit").focus();
}

//finish editing name
function nameEdit (){
	$("#detailsName").css("display","block");
	$("#detailsName_edit").css("display","none");
	var old = $("#detailsName").html();
	var cur = $("#detailsName_edit").val();
	$("#detailsName").html($("#detailsName_edit").val());
	if (old!=cur) rtmName(currentTask,cur);
}

//keypress listener for editing name
function nameKeyPress (event){
	switch (event.keyCode)
	{
		case 13: // return
		case 3:  // enter
			nameEdit();
			break;
	}
}

//gets the task list, displays them
function refresh (){
	tasks = [];
	if (!checkToken()){
		//show auth link
		$("#authDiv").show();
		$("#listDiv").hide();
		if (window.widget) $("#authDiv").html("<span id=\"authurl\" onclick=\"widget.openURL('"+rtmAuthURL("delete")+"')\">Click Here</span> to authentication.");
		else $("#authDiv").html("<a id=\"authurl\" target=\"_blank\" href=\""+rtmAuthURL("delete")+"\">Click Here</a> to authentication.");
	}else{
		//get task list
		$("#authDiv").hide();
		$("#listDiv").show();
		var temptasks = rtmCall({method:"rtm.tasks.getList",filter:document.getElementById('customtext').value});
		//var temptasks = rtmCall({method:"rtm.tasks.getList",filter:"status:incomplete"});
		temptasks = temptasks.rsp.tasks;
		if (temptasks.length!=0){ //no tasks
			if (typeof(temptasks.list.length)=="undefined"){ //only one list
				if (typeof(temptasks.list.taskseries.length)=="undefined") //only one task
					addTask(temptasks.list.taskseries,temptasks.list.id);
				else
					for (var s in temptasks.list.taskseries) //for each task
						addTask(temptasks.list.taskseries[s],temptasks.list.id);
			}else{
				for (var l in temptasks.list){ //for each list
					if (typeof(temptasks.list[l].taskseries.length)=="undefined") //only one task
						addTask(temptasks.list[l].taskseries,temptasks.list[l].id);
					else
						for (var s in temptasks.list[l].taskseries) //for each task
							addTask(temptasks.list[l].taskseries[s],temptasks.list[l].id);
				}
			}
		}
	}
	tasks.sort(sortTasks);
	$("#taskList").empty();
	for (var t in tasks){
		log(tasks[t].name);
		var date = tasks[t].date.toString().split(" ");
		var sdate = date[1]+" "+date[2];
		var d = new Date();
		var today = new Date(d.getFullYear(),d.getMonth(),d.getDate());
		var tmr = new Date(d.getFullYear(),d.getMonth(),d.getDate()+1);
		var week = new Date(d.getFullYear(),d.getMonth(),d.getDate()+7);
		if (tasks[t].date>=today&&tasks[t].date<tmr)
			sdate = "Today"; //Today
		if (tasks[t].date>=tmr&&tasks[t].date<week&&tasks[t].task.has_due_time==1)
			sdate = tasks[t].date.format("ddd"); //Within a week, short day
		if (tasks[t].date>=tmr&&tasks[t].date<week&&tasks[t].task.has_due_time==0)
			sdate = tasks[t].date.format("dddd"); //Within a week, long day
        if (tasks[t].task.has_due_time==1)
			sdate += " @ "+ tasks[t].date.format("h:MM TT");
		if (tasks[t].date<today)
			sdate += " (Overdue)"; //overdue
		if (tasks[t].date.getTime()==2147483647000)
			sdate = ""; //no due date
		$("#taskList").append("<li><input type=\"checkbox\" onclick=\"rtmComplete("+t+")\"/><span class=\"taskname\" onclick=\"showDetails("+t+")\">"+tasks[t].name+"</span><span class=\"duedate\">"+sdate+"</span></li>");
	}

	if (lastTrans==null) $("#undo").hide();
	else $("#undo").show();

	gMyScrollArea.refresh();
}

//add a task to tasks array, also include list_id and date
function addTask (t,list_id) {
	var d = new Date();
	if (t.task.due=="") d.setTime(2147483647000); //no due date
	else d.setISO8601(t.task.due);
	t.date = d;
	log(t.date);
	t.list_id = list_id;
	tasks.push(t);
}

//helper function to sort array of Dates
function sortTasks (t1, t2){
	return t1.date-t2.date;
}

//add a task when return or enter is pressed
function inputKeyPress (event){
	switch (event.keyCode)
	{
		case 13: // return
		case 3:  // enter
			rtmAdd(document.getElementById('taskinput').value);
			document.getElementById('taskinput').value = '';
			break;
	}
}

//done with filter, return to front
function filterKeyPress (event){
	switch (event.keyCode)
	{
		case 13: // return
		case 3:  // enter
			filterChange();
			showFront();
			break;
	}
}

//setISO8601 function by Paul Sowden (http://delete.me.uk/2005/03/iso8601.html)
Date.prototype.setISO8601 = function (string) {
	var regexp = "([0-9]{4})(-([0-9]{2})(-([0-9]{2})" +
	"(T([0-9]{2}):([0-9]{2})(:([0-9]{2})(\.([0-9]+))?)?" +
	"(Z|(([-+])([0-9]{2}):([0-9]{2})))?)?)?)?";
	var d = string.match(new RegExp(regexp));

	var offset = 0;
	var date = new Date(d[1], 0, 1);

	if (d[3]) { date.setMonth(d[3] - 1); }
	if (d[5]) { date.setDate(d[5]); }
	if (d[7]) { date.setHours(d[7]); }
	if (d[8]) { date.setMinutes(d[8]); }
	if (d[10]) { date.setSeconds(d[10]); }
	if (d[12]) { date.setMilliseconds(Number("0." + d[12]) * 1000); }
	if (d[14]) {
		offset = (Number(d[16]) * 60) + Number(d[17]);
		offset *= ((d[15] == '-') ? 1 : -1);
	}

	offset -= date.getTimezoneOffset();
	time = (Number(date) + (offset * 60 * 1000));
	this.setTime(Number(time));
}

//debug
function log (s){
	if (debug) alert(s);
}