import React, { forwardRef, useEffect, useRef, useState } from 'react'
import { View, Text, StyleSheet, Dimensions } from 'react-native'
import MapView, { PROVIDER_GOOGLE, Marker, Overlay, Polyline, Circle, type Region } from 'react-native-maps'
import { WebView } from 'react-native-webview'
import * as FileSystem from 'expo-file-system/legacy'
import type { RoutePoint } from '../types/flood'
import { apiRequest, windowQuery, type RouteComparison, type RainfallSource, type DrainageResponse } from '../api/floodApi'
import { getApiBase } from '../api/config'
import { useTheme } from '../theme/ThemeProvider'
import { rasterDecoderHtml } from './rasterDecoder'

export const HOME: Region = { latitude: 19.076, longitude: 72.8777, latitudeDelta: .19, longitudeDelta: .19 }
const darkStyle = [
  {elementType:'geometry',stylers:[{color:'#202633'}]},
  {elementType:'labels.text.fill',stylers:[{color:'#c4cad5'}]},
  {elementType:'labels.text.stroke',stylers:[{color:'#171c27'}]},
  {featureType:'landscape',stylers:[{color:'#242a35'}]},
  {featureType:'poi',elementType:'geometry',stylers:[{color:'#28313a'}]},
  {featureType:'poi.park',elementType:'geometry',stylers:[{color:'#243c36'}]},
  {featureType:'road',elementType:'geometry',stylers:[{color:'#414957'}]},
  {featureType:'road.highway',elementType:'geometry',stylers:[{color:'#6a6052'}]},
  {featureType:'water',elementType:'geometry',stylers:[{color:'#121e31'}]},
  {featureType:'poi',elementType:'labels.icon',stylers:[{visibility:'off'}]},
]
type Road = { geometry: { coordinates: [number,number][] }; properties: { flood_risk: number } }
interface Props {
  mapType: 'standard'|'satellite'; event: string; minutes?: number; source: RainfallSource; refresh: number
  start: RoutePoint|null; end: RoutePoint|null; inspectCoord: RoutePoint|null; routes: RouteComparison|null
  floodVisible: boolean; traffic: boolean; roadsVisible: boolean; drainage: DrainageResponse|null; drainageMode: 'summary'|'affected'|'full'
  onMapPress: (coord: {latitude:number;longitude:number})=>void; onStatus: (status:string)=>void
}
const coordinates = (line: [number,number][]) => line.map(([longitude,latitude])=>({latitude,longitude}))
export const InteractiveMap = forwardRef<MapView, Props>(function InteractiveMap(props, ref) {
  const { dark } = useTheme()
  const decoder = useRef<WebView>(null)
  const [ready,setReady] = useState(false)
  const [region,setRegion] = useState(HOME)
  const [roads,setRoads] = useState<Road[]>([])
  const [raster,setRaster] = useState<{uri:string;bounds:[[number,number],[number,number]]}|null>(null)
  const requestId = useRef(0), lastRefresh = useRef(-1), lastBase = useRef('')
  const files = useRef<string[]>([])
  const zoom = Math.log2(360/region.longitudeDelta)
  const scale = Math.max(.65,Math.min(1,.65+(zoom-10)*.07))
  useEffect(()=>{
    const id=++requestId.current
    setRaster(null)
    if(!ready || !props.event || !props.floodVisible) { props.onStatus(''); return }
    props.onStatus('Loading susceptibility map…')
    const apiBase=getApiBase()
    const request={id,apiBase,event:props.event,minutes:props.minutes,source:props.source,refresh:lastRefresh.current!==props.refresh || lastBase.current!==apiBase}
    lastRefresh.current=props.refresh; lastBase.current=apiBase
    decoder.current?.injectJavaScript(`window.renderFlood(${JSON.stringify(request)});true;`)
  },[ready,props.event,props.minutes,props.source,props.refresh,props.floodVisible])
  useEffect(()=>()=>{ for(const uri of files.current) void FileSystem.deleteAsync(uri,{idempotent:true}) },[])
  useEffect(()=>{
    setRoads([])
    if(!props.roadsVisible || !props.event || zoom<14) return
    const controller=new AbortController()
    const query=new URLSearchParams(windowQuery(props.minutes,props.source).slice(1))
    query.set('west',String(region.longitude-region.longitudeDelta/2));query.set('east',String(region.longitude+region.longitudeDelta/2))
    query.set('south',String(region.latitude-region.latitudeDelta/2));query.set('north',String(region.latitude+region.latitudeDelta/2))
    const timer=setTimeout(()=>{ apiRequest(`/flood/roads/${encodeURIComponent(props.event)}?${query}`,controller.signal).then(r=>r.json()).then(data=>{if(!controller.signal.aborted)setRoads(data.features)}).catch(error=>{if(!controller.signal.aborted)props.onStatus(`Road risk: ${error.message}`)}) },200)
    return ()=>{clearTimeout(timer);controller.abort()}
  },[region,props.roadsVisible,props.event,props.minutes,props.source,props.refresh])
  const inView=([lon,lat]:[number,number])=>Math.abs(lon-region.longitude)<region.longitudeDelta*.6 && Math.abs(lat-region.latitude)<region.latitudeDelta*.6
  const manholes=props.drainageMode==='summary'?[]:(props.drainage?.manholes?.features??[]).filter(f=>inView(f.geometry.coordinates)&&(props.drainageMode==='affected'||f.properties.surcharged||zoom>=13))
  const conduits=props.drainageMode==='summary'||zoom<15?[]:(props.drainage?.conduits?.features??[]).filter(f=>f.geometry.coordinates.some(inView))
  const lines=[{key:'fastest',coords:props.routes?.normal_route.coordinates,color:'#475569',outline:'#e2e8f0',width:5,z:20},
    {key:'suggested',coords:props.routes?.suggested_route?.coordinates,color:'#f59e0b',outline:'#0f172a',width:5,z:22},
    {key:'safe',coords:props.routes?.tolerance_route?.coordinates,color:'#00d5ff',outline:'#0f172a',width:6,z:24}]
  return <View style={StyleSheet.absoluteFill}>
    <MapView key={props.mapType==='satellite'?'satellite':dark?'street-dark':'street-light'}
      ref={ref} provider={PROVIDER_GOOGLE} style={StyleSheet.absoluteFill} initialRegion={region}
      userInterfaceStyle="light"
      mapType={props.mapType==='satellite'?'hybrid':'standard'} customMapStyle={props.mapType==='standard'&&dark?darkStyle:[]}
      showsTraffic={props.traffic} showsCompass zoomControlEnabled showsMyLocationButton={false}
      onRegionChangeComplete={setRegion} onPress={e=>props.onMapPress(e.nativeEvent.coordinate)}>
      {raster&&props.floodVisible&&<Overlay image={{uri:raster.uri}} bounds={raster.bounds} />}
      {roads.map((road,i)=><Polyline key={`road-${i}`} coordinates={coordinates(road.geometry.coordinates)} strokeWidth={3} strokeColor={['#38bdf8','#facc15','#fb923c','#ef4444'][Math.min(3,Math.max(0,Math.floor(road.properties.flood_risk*4)))]} zIndex={7}/>)}
      {conduits.map((f,i)=><Polyline key={`conduit-${i}`} coordinates={coordinates(f.geometry.coordinates)} strokeColor={f.properties.surcharged?'#ef4444':Number(f.properties.surcharge_ratio)>.5?'#fbbf24':'#4ade80'} strokeWidth={1.5} zIndex={8}/>)}
      {manholes.map((f,i)=><Circle key={`manhole-${i}`} center={{longitude:f.geometry.coordinates[0],latitude:f.geometry.coordinates[1]}} radius={Math.max(1,region.longitudeDelta*111000*Math.cos(region.latitude*Math.PI/180)/Dimensions.get('window').width*3.5)} fillColor={f.properties.surcharged?'#f87171':Number(f.properties.surcharge_ratio)>.5?'#fbbf24':'#4ade80'} strokeColor="#ffffff" strokeWidth={1} zIndex={10}/>)}
      {lines.filter(line=>line.coords?.length).map(line=><React.Fragment key={line.key}>
        <Polyline coordinates={coordinates(line.coords!)} strokeColor={line.outline} strokeWidth={(line.width+3)*scale} zIndex={line.z}/>
        <Polyline coordinates={coordinates(line.coords!)} strokeColor={line.color} strokeWidth={line.width*scale} lineDashPattern={line.key==='suggested'?[4,3]:undefined} zIndex={line.z+1}/>
      </React.Fragment>)}
      {[{point:props.start,title:'A'},{point:props.end,title:'B'},{point:props.inspectCoord,title:'Inspect'}].map(({point,title})=>point&&<Marker key={title} coordinate={{latitude:point.lat,longitude:point.lng}} title={title} tracksViewChanges={false} anchor={{x:.5,y:.5}}><View style={{width:30,height:30,borderRadius:15,backgroundColor:title==='Inspect'?'#8a4b08':'#0085b5',borderWidth:2,borderColor:'#ffffff',alignItems:'center',justifyContent:'center'}}><Text style={{color:'#ffffff',fontWeight:'700'}}>{title==='Inspect'?'＋':title}</Text></View></Marker>)}
    </MapView>
    <View pointerEvents="none" style={{width:1,height:1,opacity:0,position:'absolute',overflow:'hidden'}}>
      <WebView ref={decoder} originWhitelist={['*']} source={{html:rasterDecoderHtml,baseUrl:getApiBase()+'/'}} javaScriptEnabled
        onMessage={async e=>{
          try { const data=JSON.parse(e.nativeEvent.data)
            if(data.ready){setReady(true);return}
            if(data.id!==requestId.current)return
            if(data.error){props.onStatus(data.error);return}
            const uri=FileSystem.cacheDirectory+`flood-${Date.now()}-${data.id}.png`
            await FileSystem.writeAsStringAsync(uri,data.image.url.split(',')[1],{encoding:FileSystem.EncodingType.Base64})
            files.current.push(uri)
            while(files.current.length>3) void FileSystem.deleteAsync(files.current.shift()!,{idempotent:true})
            if(data.id!==requestId.current)return
            const c=data.image.coordinates
            setRaster({uri,bounds:[[c[1][1],c[1][0]],[c[3][1],c[3][0]]]});props.onStatus('')
          }catch(error){props.onStatus(`Map display failed: ${String(error)}`)}
        }}/>
    </View>
  </View>
})
