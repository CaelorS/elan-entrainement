import type {Entry,Exercise} from '../lib/types';
import {changeExerciseFormat,exerciseFormats,formatFor} from '../lib/exercise-format';
export function ExerciseFormatFields({ex,plan,onChange}:{ex:Exercise;plan:Entry;catalogue:Exercise[];onChange:(entry:Entry)=>void}){
 const format=formatFor(ex,plan);
 return <div className="exercise-format-fields"><label>Format de l’exercice<select value={format} onChange={e=>onChange(changeExerciseFormat(ex,plan,e.target.value as typeof format))}>{exerciseFormats.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}</select></label><p className="subtle">{exerciseFormats.find(option=>option.value===format)?.help}</p></div>;
}
