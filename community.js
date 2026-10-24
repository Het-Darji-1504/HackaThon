(() => {
"use strict";
const C={plumbing:{label:"Plumbing",symbol:"🔧",color:"#315B43"},electrical:{label:"Electrical work",symbol:"⚡",color:"#A16207"},cleaning:{label:"Cleaning",symbol:"🧹",color:"#036B66"},cooking:{label:"Cooking & daily help",symbol:"🍳",color:"#B45335"},carpentry:{label:"Carpentry",symbol:"🪚",color:"#475569"},painting:{label:"Painting",symbol:"🎨",color:"#6D28D9"}};
const $=id=>document.getElementById(id);
const db=window.supabase?.createClient&&window.WORK_SATTHI_SUPABASE_URL&&window.WORK_SATTHI_SUPABASE_KEY?window.supabase.createClient(window.WORK_SATTHI_SUPABASE_URL,window.WORK_SATTHI_SUPABASE_KEY):null;
let map,markers=[],chosen=null;
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const result=r=>{if(r.error)throw r.error;return r.data;};
async function getReports(){if(!db)throw Error("Supabase client/configuration unavailable.");return result(await db.from("service_requests").select("*").order("created_at",{ascending:false}).limit(300))||[];}
function markerIcon(cat){const x=C[cat]||C.cleaning;return L.divIcon({className:"issue-marker-shell",html:'<span class="issue-marker" style="--marker-color:'+x.color+'">'+x.symbol+'</span>',iconSize:[34,34],iconAnchor:[17,17],popupAnchor:[0,-15]});}
function coords(lat,lng,zoom){if(lat<6.5||lat>37.5||lng<68||lng>98.5){$("form-feedback").textContent="Choose a location within India.";return;}chosen={lat,lng};$("report-lat").value=lat.toFixed(5);$("report-lng").value=lng.toFixed(5);$("map-status").textContent="Location selected.";if(zoom)map.setView([lat,lng],Math.max(map.getZoom(),10));}
function locate(){if(!navigator.geolocation){$("form-feedback").textContent="Location unavailable; tap the map instead.";return;}$("form-feedback").textContent="Waiting for location permission…";navigator.geolocation.getCurrentPosition(p=>{coords(p.coords.latitude,p.coords.longitude,true);$("form-feedback").textContent="Coordinates filled. For privacy, consider using a nearby public landmark.";},e=>{$("form-feedback").textContent=({1:"Location permission denied. Tap the map instead.",2:"Location unavailable. Tap the map instead.",3:"Location request timed out."})[e.code]||"Could not get location.";},{timeout:12000,maximumAge:60000});}
async function refresh(){
if(!map)return;markers.forEach(m=>map.removeLayer(m));markers=[];
try{
const all=await getReports(),f=$("map-filter").value,rf=$("reports-filter").value;
all.filter(r=>f==="all"||r.category===f).forEach(r=>{if(!Number.isFinite(Number(r.latitude))||!Number.isFinite(Number(r.longitude)))return;const x=C[r.category]||C.cleaning,m=L.marker([+r.latitude,+r.longitude],{icon:markerIcon(r.category)}).addTo(map);m.bindPopup('<div class="map-popup"><strong>📌 '+esc(r.title)+'</strong><span class="popup-category">'+esc(x.label)+' · Service request</span><p>'+esc(r.description)+'</p><small>'+esc(r.location_text)+'</small>'+(r.photo_url?'<p><a target="_blank" rel="noopener" href="'+esc(r.photo_url)+'">View attached photo</a></p>':'')+'</div>');m._requestId=r.id;markers.push(m);});
$("report-total").textContent=all.length;
const visible=all.filter(r=>rf==="all"||r.category===rf);
$("reports-list").innerHTML=visible.map(r=>{const x=C[r.category]||C.cleaning;return '<article class="report-card"><div class="report-card-top"><span class="legend-symbol" style="--marker-color:'+x.color+'">'+x.symbol+'</span><span class="report-category">'+esc(x.label)+'</span><span class="report-status">Service request</span></div><h3>'+esc(r.title)+'</h3><p>'+esc(r.description)+'</p><div class="report-location">⌖ '+esc(r.location_text)+'</div>'+(r.photo_url?'<p><a target="_blank" rel="noopener" href="'+esc(r.photo_url)+'">View photo</a></p>':'')+'<div class="report-card-bottom"><span>'+esc(new Date(r.created_at).toLocaleDateString())+(r.reporter_name?' · '+esc(r.reporter_name):'')+'</span><button class="text-button" type="button" data-report-id="'+esc(r.id)+'">View on map →</button></div></article>';}).join("");
$("empty-reports").hidden=visible.length>0;
$("reports-list").querySelectorAll("[data-report-id]").forEach(b=>b.addEventListener("click",()=>{const m=markers.find(x=>x._requestId===b.dataset.reportId);if(m){map.setView(m.getLatLng(),13);m.openPopup();$("explore-map").scrollIntoView({behavior:"smooth"});}}));
$("map-status").textContent=markers.length+" service request marker(s) shown. Worker profiles are a separate type and are not pinned because profiles currently lack coordinates.";
}catch(e){$("map-status").textContent="Shared requests could not load: "+(e.message||"Run the Supabase community setup SQL and check RLS.");$("reports-list").innerHTML="";$("empty-reports").hidden=false;$("report-total").textContent="—";}
}
function init(){
if(!window.L){$("map-status").textContent="Map library could not load. Check your connection.";return;}
map=L.map("india-map",{minZoom:4,maxZoom:18}).setView([22.8,79],5);L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}).addTo(map);map.setMaxBounds([[5.5,66.5],[38.8,100]]);map.on("click",e=>coords(e.latlng.lat,e.latlng.lng,true));
$("category-total").textContent=Object.keys(C).length;
$("legend-list").innerHTML=Object.entries(C).map(([k,x])=>'<div class="legend-item"><span class="legend-symbol" style="--marker-color:'+x.color+'">'+x.symbol+'</span><span>'+esc(x.label)+'</span></div>').join("");
refresh();
}
$("community-report-form").addEventListener("submit",async e=>{
e.preventDefault();const form=$("community-report-form"),btn=form.querySelector('[type="submit"]'),file=$("report-photo").files[0],lat=Number($("report-lat").value),lng=Number($("report-lng").value),category=$("report-category").value,title=$("report-title").value.trim(),description=$("report-description").value.trim(),location=$("report-location").value.trim();
if(!C[category]||title.length<3||!description||!location||!Number.isFinite(lat)||!Number.isFinite(lng)||lat<6.5||lat>37.5||lng<68||lng>98.5){$("form-feedback").textContent="Complete all required fields and choose a valid location in India.";return;}
if(file&&(!file.type.startsWith("image/")||file.size>2*1024*1024)){$("form-feedback").textContent="Choose an image no larger than 2 MB.";return;}
btn.disabled=true;$("form-feedback").textContent="Saving service request…";
try{if(!db)throw Error("Supabase client/configuration unavailable.");let photoUrl=null;if(file){const ext=(file.name.split(".").pop()||"jpg").toLowerCase().replace(/[^a-z0-9]/g,"")||"jpg",path=crypto.randomUUID()+"."+ext;const up=result(await db.storage.from("service-request-photos").upload(path,file,{contentType:file.type,upsert:false}));photoUrl=db.storage.from("service-request-photos").getPublicUrl(up.path).data.publicUrl;}
result(await db.from("service_requests").insert({title,category,description,location_text:location,latitude:lat,longitude:lng,reporter_name:$("report-name").value.trim()||null,photo_url:photoUrl}));
form.reset();chosen=null;$("form-feedback").textContent="Request saved and shared with other visitors.";await refresh();map.setView([lat,lng],12);const m=markers.find(x=>Math.abs(x.getLatLng().lat-lat)<1e-6&&Math.abs(x.getLatLng().lng-lng)<1e-6);if(m)m.openPopup();$("explore-map").scrollIntoView({behavior:"smooth"});
}catch(err){$("form-feedback").textContent="Could not save request: "+(err.message||"Check Supabase setup SQL and photo-storage policies.");}finally{btn.disabled=false;}
});
$("report-photo").addEventListener("change",()=>{const f=$("report-photo").files[0];if(f&&(!f.type.startsWith("image/")||f.size>2*1024*1024)){$("report-photo").value="";$("form-feedback").textContent="Choose an image no larger than 2 MB.";return;}$("form-feedback").textContent=f?"Photo selected; it will upload with the request.":"";});
$("locate-me").addEventListener("click",locate);$("form-locate").addEventListener("click",locate);$("map-filter").addEventListener("change",refresh);$("reports-filter").addEventListener("change",refresh);
const menu=$("menu-toggle");if(menu)menu.addEventListener("click",()=>{const open=menu.getAttribute("aria-expanded")==="true";menu.setAttribute("aria-expanded",String(!open));$("nav-links").classList.toggle("is-open",!open);});
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();