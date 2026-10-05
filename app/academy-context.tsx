'use client';
import {createContext,useContext} from 'react';
export const AcademyContext=createContext<any>(null);
export const useAcademy=()=>useContext(AcademyContext);
