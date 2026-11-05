export const genderOptions=[['unspecified','Non spécifié'],['male','Homme'],['female','Femme'],['other','Autre']] as const;
export const illustrationOptions=[['mixed','Mixte'],['male','Homme'],['female','Femme']] as const;
export type Gender=typeof genderOptions[number][0];
export type IllustrationGender=typeof illustrationOptions[number][0];
export type AccountProfile={gender:Gender;illustration_gender:IllustrationGender};
export const defaultProfile:AccountProfile={gender:'unspecified',illustration_gender:'mixed'};
export function parseProfile(value:unknown):AccountProfile|null{
 if(!value||typeof value!=='object')return null;
 const v=value as AccountProfile;
 return genderOptions.some(([key])=>key===v.gender)&&illustrationOptions.some(([key])=>key===v.illustration_gender)?{gender:v.gender,illustration_gender:v.illustration_gender}:null;
}
