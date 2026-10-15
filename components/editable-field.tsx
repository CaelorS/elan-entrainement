import {useState,type InputHTMLAttributes,type TextareaHTMLAttributes} from 'react';

// Keep the blank editing draft separate from saved data. Merely focusing a field
// must never persist zero or erase an existing value.
export function EditableInput({value,defaultValue,onFocus,onBlur,onChange,...props}:InputHTMLAttributes<HTMLInputElement>){
 const [editing,setEditing]=useState(false),[changed,setChanged]=useState(false),[draft,setDraft]=useState(''),[local,setLocal]=useState(defaultValue??''),[previous,setPrevious]=useState('');
 const current=value??local;
 if(['checkbox','radio','file','date','time','datetime-local','range','color','hidden','submit','button'].includes(props.type??''))return <input {...props} value={value} defaultValue={defaultValue} onFocus={onFocus} onBlur={onBlur} onChange={onChange}/>;
 return <input {...props} data-editable-value="true" value={editing?draft:current} placeholder={editing?previous:props.placeholder} onFocus={e=>{setPrevious(String(current));setDraft('');setChanged(false);setEditing(true);onFocus?.(e)}} onChange={e=>{const raw=e.currentTarget.value;setDraft(raw);setChanged(true);if(raw!==''||props.type!=='number'){if(value===undefined)setLocal(raw);onChange?.(e)}}} onBlur={e=>{if(e.currentTarget.value===''&&(!changed||props.type==='number'))e.currentTarget.value=String(current);setEditing(false);onBlur?.(e)}}/>;
}
export function EditableTextarea({value,defaultValue,onFocus,onBlur,onChange,...props}:TextareaHTMLAttributes<HTMLTextAreaElement>){
 const [editing,setEditing]=useState(false),[changed,setChanged]=useState(false),[draft,setDraft]=useState(''),[local,setLocal]=useState(defaultValue??''),[previous,setPrevious]=useState('');
 const current=value??local;
 return <textarea {...props} value={editing?draft:current} placeholder={editing?previous:props.placeholder} onFocus={e=>{setPrevious(String(current));setDraft('');setChanged(false);setEditing(true);onFocus?.(e)}} onChange={e=>{const raw=e.currentTarget.value;setDraft(raw);setChanged(true);if(value===undefined)setLocal(raw);onChange?.(e)}} onBlur={e=>{if(e.currentTarget.value===''&&!changed)e.currentTarget.value=String(current);setEditing(false);onBlur?.(e)}}/>;
}
