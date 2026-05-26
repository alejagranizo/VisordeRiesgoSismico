#!/usr/bin/python
# -*- coding: utf-8 -*-



"""
by Alejandra Granizo Caballo
Topography and Cartography Department
Technical University of Madrid, Spain
May 2026

"""
import sys, os
# Garantiza que compassbearing.py se encuentra aunque el proceso
# se haya lanzado desde un directorio distinto a pythonCode/
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from math import sin, cos, tan, radians, sqrt, pow
#from geopy.distance import vincenty
#from geopy.distance import VincentyDistance
from geopy.distance import geodesic
import pyproj
import shapely.geometry
import geopy 
from compassbearing import Calculate_Bearing
import geopandas  

###############################################################################
"""
The function Fault_Proj takes:
      (1)fault dictonary defined in main()

       and finds 4 fault points projected on surface for:
       vertical projection to the fault: fault_projrup=[p1,p2,p3,p4]
       vertical projection to the surface :fault_projjb=[p1,p2,p3,p4]
       each p is a tuple of (lat,long) in decimal degree (with 5 decimals)
       
       RETURNS:
           [fault_projjb,fault_projrup]
"""     

def Fault_Proj(faultDisctionaty):
    #This function returns an list of vertices of projected surface as below:
    #[P1,P2,P3,P4]
    # Where Pi is a tuple (lat,long)
    ######## Rjb needs Radial (Earth Radius) projection and Rrup needs Vertical (to the fault plane) projection:
    #
    #     P1jb  P1rup  P4jb            P4rup
    # -----|-----%-----|---------------%-------Surface
    #      |   %       |             %
    #      | %         |           %
    #      0...........|         %
    #        \\        |       %
    #          \\      |     %
    #   fault->  \\    |   %
    #              \\  | %
    #                \\|
    #  
    ########              
    # CORRECCIÓN: limitar dip a 89.9° para evitar que cos(90°)≈0 produzca
    # distancias astronómicas (Rtop, X → ∞) que hacen fallar geopy.
    # Las fallas verticales (strike-slip puras con dip=90°) se aproximan con
    # dip=89.9° sin pérdida apreciable de precisión en las distancias Rjb/Rrup.
    faultDisctionaty = dict(faultDisctionaty)   # copia para no mutar el original
    faultDisctionaty['dip'] = min(faultDisctionaty.get('dip', 45), 89.9)

    origin = geopy.Point(faultDisctionaty.get('lat'), faultDisctionaty.get('long')) #Point reads latitue then longitude
    normal_to_faultStrike=faultDisctionaty.get('azimuth')+90

    fault_projjb_vertex1=(faultDisctionaty.get('lat'), faultDisctionaty.get('long'))
    # Point 2
    destination =geodesic(kilometers=faultDisctionaty.get('length')).destination(origin, faultDisctionaty.get('azimuth'))
    # destination = VincentyDistance(kilometers=faultDisctionaty.get('length')).destination(origin, faultDisctionaty.get('azimuth')) #(lat,long)
    fault_projjb_vertex2= (round(destination.latitude,5), round(destination.longitude,5))
    # Point 3
    proj_wide_size=faultDisctionaty.get('wide')*cos(radians(faultDisctionaty.get('dip')))
    destination = geodesic(kilometers=proj_wide_size).destination(geopy.Point(fault_projjb_vertex2),normal_to_faultStrike)
    fault_projjb_vertex3= (round(destination.latitude,5), round(destination.longitude,5))
    # Point 4
    destination = geodesic(kilometers=proj_wide_size).destination(origin,normal_to_faultStrike)
    fault_projjb_vertex4= (round(destination.latitude,5), round(destination.longitude,5))
    
    fault_projjb=[fault_projjb_vertex1,fault_projjb_vertex2,fault_projjb_vertex3,fault_projjb_vertex4]

    r=tan(radians(faultDisctionaty.get('dip')))*faultDisctionaty.get('Ztor')
    destination=geodesic(kilometers=r).destination(origin,normal_to_faultStrike)
    fault_projrup_vertex1= (round(destination.latitude,5), round(destination.longitude,5))
    # Point 2
    destination = geodesic(kilometers=faultDisctionaty.get('length')).destination(geopy.Point(fault_projrup_vertex1), faultDisctionaty.get('azimuth'))
    fault_projrup_vertex2= (round(destination.latitude,5), round(destination.longitude,5))
    # Point 3
    proj_wide_size=faultDisctionaty.get('wide')/cos(radians(faultDisctionaty.get('dip')))
    destination = geodesic(kilometers=proj_wide_size).destination(geopy.Point(fault_projrup_vertex2),normal_to_faultStrike)
    fault_projrup_vertex3= (round(destination.latitude,5), round(destination.longitude,5))
    # Point 4
    destination = geodesic(kilometers=proj_wide_size).destination(geopy.Point(fault_projrup_vertex1),normal_to_faultStrike)
    fault_projrup_vertex4= (round(destination.latitude,5), round(destination.longitude,5))
    
    fault_projrup=[fault_projrup_vertex1,fault_projrup_vertex2,fault_projrup_vertex3,fault_projrup_vertex4] 

    return [fault_projjb,fault_projrup] # is two list of 4 tuples (lat,long)
###############################################################################
"""The function Find_R_Zones finds the zone for each grid point
       inputs: (1)tuple(lat,long) in decimal degree
               (2)Projected vertices of fault on the surface
               (3)fault strike
               (4)The projection type is given with RType
                    
"""
def Find_R_Zones(latlongPoint,faultProjVertices,faultStrike,RType):
    ######## Zones are as below:
    
    #          |           |
    #     1    |     2     |    3
    #          |           |
    #----------P2=========P3-----------
    #         ||+++++++++++|
    #         ||+++++++++++|
    #     4   ||+++++5+++++|    6
    #         ||+++++++++++|
    #         ||+++++++++++|
    #         ||+++++++++++|
    #----------P1=========P4-----------  
    #          |           |
    #    7     |     8     |    9
    #          |           |

    if RType=='Rjb':
        i=0
    if RType=='Rrup':
        i=1
    if RType!='Rrup' and RType!='Rjb':
        print('ERROR:Unkown distance type')
        return   

    bearing=round(Calculate_Bearing(faultProjVertices[i][0],latlongPoint)) 

    if bearing==faultStrike or bearing==faultStrike+360 or bearing==faultStrike-360:
        # grid point is on the faultStrike projection line +
        if geodesic(faultProjVertices[i][0], latlongPoint).kilometers<=geodesic(faultProjVertices[i][0],faultProjVertices[i][1]).kilometers:
            zone=5
        else:
            zone=1
        alpha=0
    else:
        if bearing==faultStrike-180 or bearing==faultStrike+180:
            # grid point is on the faultStrike projection line -
            zone=7
            alpha=0
        else:
            if bearing<faultStrike:
                bearing=bearing+360                    
            alpha=bearing-faultStrike
            if alpha>180: # 180<alpha<360
                # grid point is on the foot-wall side
                if alpha<=270: # 180<alpha<=270
                    zone=7
                else: # 270<alpha 
                    bearing_prime=round(Calculate_Bearing(faultProjVertices[i][1],latlongPoint)) 
                    if bearing_prime<faultStrike:
                        bearing_prime=bearing_prime+360
                    alpha_prime=bearing_prime-faultStrike 
                    if alpha_prime>=270:
                        zone=1
                    elif alpha_prime>180:
                        zone=4
                    else:
                        zone=5          
            else: # 0<alpha<180
                # grid point is on the hanging-wall side
                if alpha==90:
                    if geodesic(faultProjVertices[i][0], latlongPoint).kilometers<=geodesic(faultProjVertices[i][0],faultProjVertices[i][3]).kilometers:
                        zone=5
                    else:
                        zone=9
                else:
                    if alpha>90: # 90<alpha<180 zone 8 or 9
                        bearing_prime=round(Calculate_Bearing(faultProjVertices[i][3],latlongPoint))
                        if bearing_prime<faultStrike:
                            bearing_prime=bearing_prime+360
                        alpha_prime=bearing_prime-faultStrike 
                        if alpha_prime<=180:
                            zone=9
                        elif alpha_prime<270:
                            zone=8
                        else:
                            zone=5
                    else: # 0<alpha<90 zone 2,3,5,6
                        bearing_prime=round(Calculate_Bearing(faultProjVertices[i][2],latlongPoint))
                        if bearing_prime<faultStrike:
                            bearing_prime=bearing_prime+360
                        alpha_prime=bearing_prime-faultStrike 
                        if alpha_prime>270:
                            if alpha_prime<360:
                                zone=2
                            else:
                                zone=3
                        else:
                            if alpha_prime>=180:
                                zone=5
                            elif alpha_prime>90:
                                zone=6
                            else:
                                zone=3   
    return int(zone)


###############################################################################
"""The function Zone_Based_distance 
       runs Find_R_Zones 
       inputs: (1)tuple(lat,long) in decimal degree 
               (2)zone
               (3)Projected vertices of fault on the surface 
               (4)Fault Dictionary
               (5)projection type via Rtype
"""

def Zone_Based_Distance(latlongPoint,zone,faultProjVertices,faultDisctionaty,RType):
    # CORRECCIÓN: misma protección que en Fault_Proj — dip limitado a 89.9°.
    # Necesario porque Zone_Based_Distance calcula Rtop=Ztor/cos(dip) y
    # X=Rtop/sin(dip), que con dip=90° producen valores ~8×10¹⁶ km.
    faultDisctionaty = dict(faultDisctionaty)
    faultDisctionaty['dip'] = min(faultDisctionaty.get('dip', 45), 89.9)

    fault_Point1jb=faultProjVertices[0][0]
    fault_Point2jb=faultProjVertices[0][1]
    fault_Point3jb=faultProjVertices[0][2]
    fault_Point4jb=faultProjVertices[0][3]
    fault_Point1rup=faultProjVertices[1][0]
    fault_Point2rup=faultProjVertices[1][1]
    fault_Point3rup=faultProjVertices[1][2]
    fault_Point4rup=faultProjVertices[1][3]
    Ztor=faultDisctionaty.get('Ztor')
    Zdown=Ztor+faultDisctionaty.get('wide')*sin(radians(faultDisctionaty.get('dip')))
    Rtop=Ztor/cos(radians(faultDisctionaty.get('dip')))
    Rdown=Zdown/cos(radians(faultDisctionaty.get('dip')))
    X=Rtop/sin(radians(faultDisctionaty.get('dip')))
    oposite_strike=faultDisctionaty.get('azimuth')+180


    def Distance_Point_to_Line(P0,P1,P2):
        p=pyproj.Proj(proj='utm',zone=30, ellps='WGS84')    
        [point_x,point_y]=p(P0[1],P0[0]) #pyproj.Proj calls (long,lat)
        [line_Point1_x,line_Point1_y]=p(P1[1],P1[0])
        [line_Point2_x,line_Point2_y]=p(P2[1],P2[0])
        triangle=shapely.geometry.Polygon([(point_x,point_y),(line_Point1_x,line_Point1_y),(line_Point2_x,line_Point2_y)])
        g=geopandas.GeoSeries([triangle])
        D=(g.area[0]/(geodesic(P1, P2).kilometers))/500000
        return D
    
    def Rjb_Zone_1(gridPoint):
        Rjb=geodesic(gridPoint, fault_Point2jb).kilometers
        return Rjb
    def Rrup_Zone_1(gridPoint):
        R=Rjb_Zone_1(gridPoint)
        Rrup=sqrt(pow(Ztor,2)+pow(R,2))
        return Rrup
    #-----------------------------------------------------------------------
    def Rjb_Zone_2(gridPoint):
        Rjb=Distance_Point_to_Line(gridPoint,fault_Point2jb,fault_Point3jb)
        return Rjb
    def Rrup_Zone_2(gridPoint):
        R=Distance_Point_to_Line(gridPoint,fault_Point2rup,fault_Point3rup)
        dest=geodesic(kilometers=R).destination(gridPoint,oposite_strike)
        Pm=(round(dest.latitude,3), round(dest.longitude,3))
        h=Rdown*((X+ geodesic(fault_Point2rup,Pm).kilometers)/(X+geodesic(fault_Point2rup,fault_Point3rup).kilometers))
        Rrup=sqrt(pow(h,2)+pow(R,2))
        return Rrup
    #-----------------------------------------------------------------------  
    def Rjb_Zone_3(gridPoint):
        Rjb=geodesic(gridPoint, fault_Point3jb).kilometers
        return Rjb
    def Rrup_Zone_3(gridPoint):
        R=Rjb_Zone_3(gridPoint)
        Rrup=sqrt(pow(Zdown,2)+pow(R,2))
        return Rrup
    #-----------------------------------------------------------------------
    def Rjb_Zone_4(gridPoint):
        Rjb=Distance_Point_to_Line(gridPoint,fault_Point1jb,fault_Point2jb)
        return Rjb
    def Rrup_Zone_4(gridPoint):
        Rrup=sqrt(pow(Rjb_Zone_4(gridPoint),2)+pow(Ztor,2))
        return Rrup
    #-----------------------------------------------------------------------
    def Rjb_Zone_5(gridPoint):
        return 0
    def Rrup_Zone_5(gridPoint):
        R=Distance_Point_to_Line(gridPoint,fault_Point1rup,fault_Point2rup)
        Rrup=Rdown*((X+R)/(X+geodesic(fault_Point1rup, fault_Point4rup).kilometers))
        return Rrup
    #-----------------------------------------------------------------------
    def Rjb_Zone_6(gridPoint):
        Rjb=Distance_Point_to_Line(gridPoint,fault_Point3jb,fault_Point4jb)
        return Rjb
    def Rrup_Zone_6(gridPoint):
        Rrup=sqrt(pow(Rjb_Zone_6(gridPoint),2)+pow(Zdown,2))
        return Rrup
     #-----------------------------------------------------------------------       
    def Rjb_Zone_7(gridPoint):
        Rjb=geodesic(gridPoint, fault_Point1jb).kilometers
        return Rjb
    def Rrup_Zone_7(gridPoint):
        R=Rjb_Zone_7(gridPoint)
        Rrup=sqrt(pow(Ztor,2)+pow(R,2))
        return Rrup
    #-----------------------------------------------------------------------
    def Rjb_Zone_8(gridPoint):
        Rjb=Distance_Point_to_Line(gridPoint,fault_Point1jb,fault_Point4jb)
        return Rjb
    def Rrup_Zone_8(gridPoint):
        R=Distance_Point_to_Line(gridPoint,fault_Point1rup,fault_Point4rup)
        dest=geodesic(kilometers=R).destination(gridPoint,faultDisctionaty.get('azimuth'))
        Pm=(round(dest.latitude,3), round(dest.longitude,3))
        h=Rdown*((X+geodesic(fault_Point1rup, Pm).kilometers)/(X+geodesic(fault_Point1rup,fault_Point4rup).kilometers))
        Rrup=sqrt(pow(h,2)+pow(R,2))        
        return Rrup
    #-----------------------------------------------------------------------
    def Rjb_Zone_9(gridPoint):
        Rjb=geodesic(gridPoint, fault_Point4jb).kilometers
        return Rjb
    def Rrup_Zone_9(gridPoint):
        R=Rjb_Zone_9(gridPoint)
        Rrup=sqrt(pow(Zdown,2)+pow(R,2))
        return Rrup 
        
    distance=round(eval('%s_Zone_%d(latlongPoint)'%(RType,zone)),5)
    return distance