import { create } from 'zustand';

type Handlers = {
  view: (rowId: string|number)=>void;
  edit: (rowId: string|number)=>void;
  print: (rowId: string|number)=>void;
  exportPdf?: (rowId: string|number)=>void;
  exportCsv?: (rowId: string|number)=>void;
  del: (rowId: string|number)=>void;
};

type Pos = { top:number; left:number };

type RowActionsState = {
  open: boolean;
  rowId: string|number|null;
  pos: Pos|null;
  handlers: Handlers|null;
  openAt: (args:{rowId:string|number; pos:Pos; handlers:Handlers})=>void;
  close: ()=>void;
};

export const useRequestsRowActionsStore = create<RowActionsState>((set)=>({
  open: false,
  rowId: null,
  pos: null,
  handlers: null,
  openAt: ({rowId,pos,handlers}) => set({ open:true, rowId, pos, handlers }),
  close: () => set({ open:false, rowId:null, pos:null, handlers:null }),
}));
